import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI as string;
export async function connectMongo() {
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
} 