import { Router, Request, Response } from 'express';
import { parseWhatsAppMessage, sendWhatsAppReply, validateTwilioRequest } from './twilioUtils';
import { findContactByPhone, extractPersonaFromContact, postChatSummaryToContact } from '../hubspot/hubspotContacts';
import { MessageModel } from '../mongodb/messageModel';
import { generatePersonaReply, generateChatSummary } from '../langchain/langchainClient';

// Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const router = Router();

// Middleware to validate Twilio requests
const validateTwilioMiddleware = (req: Request, res: Response, next: Function) => {
  const requestId = Math.random().toString(36).substring(7);
  
  // Get the full URL including protocol and host
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const fullUrl = `${protocol}://${host}${req.originalUrl}`;
  
  // Get the Twilio signature from headers
  const twilioSignature = req.header('x-twilio-signature');

  if (!twilioSignature) {
    console.error(`[${requestId}] Missing Twilio signature`);
    return res.status(401).json({ error: 'No Twilio signature provided' });
  }

  // Validate the request
  const isValid = validateTwilioRequest(
    fullUrl,
    req.body,
    twilioSignature
  );

  if (!isValid) {
    console.error(`[${requestId}] Invalid Twilio signature`);
    return res.status(401).json({ error: 'Invalid Twilio signature' });
  }

  // Add requestId to request object for logging
  req.requestId = requestId;
  next();
};

/**
 * Helper to fetch and format recent chat history for a conversation
 */
async function getChatHistory(phone: string, currentMessageSid: string, limit = 10) {
  try {
    // Fetch both user and assistant messages, sorted by timestamp, EXCLUDING the current incoming message
    const messages = await MessageModel.find({
      $or: [
        { from: phone }, // user messages
        { to: phone }    // assistant messages (sent to user)
      ],
      messageSid: { $ne: currentMessageSid },
    }).sort({ timestamp: 1 }).limit(limit);

    return messages
      .filter(m => m.role && m.body)
      .map(m => [m.role as "user" | "assistant", m.body] as [string, string]);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return []; // Return empty history on error
  }
}

// Apply validation middleware to webhook route
router.post('/webhook', validateTwilioMiddleware, async (req: Request, res: Response) => {
  const requestId = req.requestId || Math.random().toString(36).substring(7);
  console.log(`[${requestId}] --- Twilio Webhook Triggered ---`);

  try {
    const message = parseWhatsAppMessage(req.body);
    if (!message) {
      if (req.body.Payload && req.body.Level) {
        // This is a Twilio error/warning notification
        console.log(`[${requestId}] Received Twilio error/warning notification:`, req.body);
        return res.status(200).send('OK'); // Acknowledge Twilio notifications
      }
      // This was expected to be a WhatsApp message but failed to parse
      console.error(`[${requestId}] Failed to parse WhatsApp message from payload:`, req.body);
      return res.status(400).json({ error: 'Invalid message payload' });
    }
    console.log(`[${requestId}] Parsed WhatsApp message from: ${message.from}`);

    // HubSpot contact matching
    const phone = message.from.replace('whatsapp:', ''); // Remove 'whatsapp:' prefix
    const contact = await findContactByPhone(phone);
    if (contact) {
      console.log(`[${requestId}] Matched HubSpot contact: ${contact.id}`);
    } else {
      console.log(`[${requestId}] No HubSpot contact found for phone:`, phone);
    }

    // Store user message in MongoDB
    try {
      await MessageModel.create({
        from: message.from,
        to: message.to,
        body: message.body,
        messageSid: message.messageSid,
        contactId: contact ? contact.id : undefined,
        role: 'user',
      });
      console.log(`[${requestId}] User message stored in MongoDB`);
    } catch (err) {
      console.error(`[${requestId}] Error storing user message in MongoDB:`, err);
      // Continue execution - non-critical error
    }

    // Fetch persona and full chat history (excluding the current message)
    const persona = contact ? extractPersonaFromContact(contact) : 'default persona';
    const history = await getChatHistory(message.from, message.messageSid);

    // Enhanced system prompt with business context
    const businessContext = process.env.BUSINESS_CONTEXT || "a general helpful assistant";
    const systemPrompt = `You are a helpful, emotionally intelligent assistant for a company that is ${businessContext}. Your persona is: ${persona}.
- If you are asked for real-time information you cannot access (like current weather), politely explain your limitation and suggest a reliable source.
- If the user seems disengaged or low-energy, respond with empathy and encouragement, not just a generic offer of help.
- If the user shares personal information (like their age), remember it for the duration of the conversation and use it to answer related questions.
- You have access to the full chat history above—use it to answer questions about previous messages.`;

    // Only append the new user message if it's not already the last in history
    let promptMessages: [string, string][] = [
      ["system", systemPrompt],
      ...history,
    ];
    if (
      history.length === 0 ||
      history[history.length - 1][1] !== message.body
    ) {
      promptMessages.push(["user", message.body]);
    }

    // Generate AI reply
    let aiReply = '';
    try {
      aiReply = await generatePersonaReply(promptMessages);
      console.log(`[${requestId}] AI-generated reply sent to ${message.from}`);
    } catch (err) {
      console.error(`[${requestId}] Error generating AI reply:`, err);
      aiReply = "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
    }

    // Store assistant message in MongoDB
    if (aiReply) {
      try {
        await MessageModel.create({
          from: message.to, // assistant's number
          to: message.from, // user's number
          body: aiReply,
          messageSid: `${message.messageSid}-ai`,
          contactId: contact ? contact.id : undefined,
          role: 'assistant',
        });
        console.log(`[${requestId}] Assistant message stored in MongoDB`);
      } catch (err) {
        console.error(`[${requestId}] Error storing assistant message in MongoDB:`, err);
        // Continue execution - non-critical error
      }
    }

    // -- Start of Summarization Logic --
    const messageThreshold = parseInt(process.env.SUMMARY_MESSAGE_THRESHOLD || '20', 10);
    const timeThresholdMinutes = parseInt(process.env.SUMMARY_TIME_THRESHOLD_MINUTES || '5', 10);

    try {
      const conversationMessages = await MessageModel.find({
        $or: [{ from: message.from }, { to: message.from }],
      }).sort({ timestamp: 1 });

      if (
        conversationMessages.length > 0 &&
        contact &&
        contact.properties.email
      ) {
        const firstMessageTime = conversationMessages[0].timestamp;
        const now = new Date();
        const timeDiffMinutes = (now.getTime() - firstMessageTime.getTime()) / (1000 * 60);

        if (
          conversationMessages.length % messageThreshold === 0 ||
          (timeDiffMinutes >= timeThresholdMinutes && conversationMessages.length > 1)
        ) {
          const chatHistoryForSummary = conversationMessages
            .map(m => `${m.role}: ${m.body}`)
            .join('\n');
          
          try {
            const summary = await generateChatSummary(chatHistoryForSummary);
            
            await postChatSummaryToContact(
              contact.properties.email,
              `Chat Summary - ${new Date().toLocaleString()}`,
              summary
            );
          } catch (err) {
            console.error(`[${requestId}] Error generating or posting chat summary:`, err);
          }
        }
      }
    } catch (err) {
      console.error(`[${requestId}] Error in summarization logic:`, err);
    }
    // -- End of Summarization Logic --
    
    // Send AI reply back to WhatsApp
    if (aiReply) {
      try {
        await sendWhatsAppReply(message.from, message.to, aiReply);
      } catch (err) {
        console.error(`[${requestId}] Error sending WhatsApp reply:`, err);
        return res.status(500).json({ error: 'Failed to send reply' });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error(`[${requestId}] Unhandled error in webhook:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 