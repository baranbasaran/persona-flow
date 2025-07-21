import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  from: string;
  to: string;
  body: string;
  messageSid: string;
  timestamp: Date;
  contactId?: string; // Optional: HubSpot contact ID
  role: 'user' | 'assistant';
}

const messageSchema = new Schema<IMessage>({
  from: { type: String, required: true },
  to: { type: String, required: true },
  body: { type: String, required: true },
  messageSid: { type: String, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  contactId: { type: String },
  role: { type: String, enum: ['user', 'assistant'], required: true },
});

export const MessageModel = mongoose.model<IMessage>('Message', messageSchema); 