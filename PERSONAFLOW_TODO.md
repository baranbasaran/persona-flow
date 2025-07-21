# PersonaFlow Project TODOs

- [x] Set up the backend server with Node.js and Express, including basic routing and environment configuration.
- [x] Integrate Twilio to receive and send WhatsApp messages, including webhook setup and message parsing.
- [x] Connect to HubSpot CRM API to fetch and update contact data, including authentication and contact matching logic.
- [x] Design and implement storage (MongoDB or PostgreSQL) for messages and conversation history.
- [x] Implement Dynamic AI Persona logic: fetch persona data from CRM and craft AI prompts accordingly.
- [x] Integrate LangChain with OpenAI or Gemini to generate AI-powered replies based on persona and chat history.
- [x] Send AI-generated replies back to WhatsApp users via Twilio.
- [x] Generate auto-summarized chat timelines and display them in HubSpot CRM cards.
- [ ] Develop a React-based HubSpot CRM extension UI to display summaries and enable human-in-the-loop mode.
- [ ] Implement optional human-in-the-loop mode for manual review and override of AI replies.
- [ ] Prepare for multilingual support in AI prompts and UI (future-proofing).
- [ ] Test end-to-end flow: WhatsApp message → AI reply → CRM summary, including error handling and edge cases. 