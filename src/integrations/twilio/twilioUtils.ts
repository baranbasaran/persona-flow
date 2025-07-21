import { Twilio } from 'twilio';
import { validateRequest } from 'twilio/lib/webhooks/webhooks';

const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
const authToken = process.env.TWILIO_AUTH_TOKEN as string;

if (!accountSid || !authToken) {
  throw new Error('Twilio credentials are not set in environment variables');
}

export const twilioClient = new Twilio(accountSid, authToken);

export interface WhatsAppMessage {
  from: string;
  to: string;
  body: string;
  messageSid: string;
}

/**
 * Validates that a request is genuinely from Twilio
 * @param url - The full URL of the request
 * @param params - The request parameters
 * @param signature - The X-Twilio-Signature header
 * @returns boolean indicating if the request is valid
 */
export function validateTwilioRequest(url: string, params: any, signature: string): boolean {
  try {
    return validateRequest(
      authToken,
      signature,
      url,
      params
    );
  } catch (error) {
    console.error('Error validating Twilio request:', error);
    return false;
  }
}

/**
 * Parses a WhatsApp message from Twilio webhook payload
 * @param payload - The raw webhook payload from Twilio
 * @returns WhatsAppMessage object or null if invalid
 */
export function parseWhatsAppMessage(payload: any): WhatsAppMessage | null {
  try {
    // Validate required fields
    if (!payload || 
        typeof payload !== 'object' ||
        !payload.From ||
        !payload.To ||
        !payload.Body ||
        !payload.MessageSid) {
      console.error('Invalid webhook payload structure:', payload);
      return null;
    }

    // Validate field types
    if (typeof payload.From !== 'string' ||
        typeof payload.To !== 'string' ||
        typeof payload.Body !== 'string' ||
        typeof payload.MessageSid !== 'string') {
      console.error('Invalid field types in payload:', payload);
      return null;
    }

    // Validate WhatsApp format
    if (!payload.From.startsWith('whatsapp:') || !payload.To.startsWith('whatsapp:')) {
      console.error('Invalid WhatsApp number format:', { from: payload.From, to: payload.To });
      return null;
    }

    return {
      from: payload.From,
      to: payload.To,
      body: payload.Body.trim(),
      messageSid: payload.MessageSid,
    };
  } catch (error) {
    console.error('Error parsing WhatsApp message:', error);
    return null;
  }
}

/**
 * Sends a WhatsApp reply via Twilio
 * @param to - Recipient's WhatsApp number
 * @param from - Sender's WhatsApp number
 * @param body - Message content
 * @returns Promise<boolean> indicating success
 */
export async function sendWhatsAppReply(to: string, from: string, body: string): Promise<boolean> {
  try {
    // Validate parameters
    if (!to || !from || !body) {
      throw new Error('Missing required parameters');
    }

    if (!to.startsWith('whatsapp:') || !from.startsWith('whatsapp:')) {
      throw new Error('Invalid WhatsApp number format');
    }

    // Implement exponential backoff for retries
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await twilioClient.messages.create({
          to,
          from,
          body: body.trim(),
        });
        console.log(`WhatsApp reply sent to ${to}`);
        return true;
      } catch (error: any) {
        if (attempt === maxRetries - 1) throw error;
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retrying WhatsApp send after ${delay}ms. Error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp reply:', error);
    return false;
  }
} 