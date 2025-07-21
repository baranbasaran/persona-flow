import { Twilio } from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
const authToken = process.env.TWILIO_AUTH_TOKEN as string;

if (!accountSid || !authToken) {
  throw new Error('Twilio credentials are not set in environment variables');
}

export const twilioClient = new Twilio(accountSid, authToken); 