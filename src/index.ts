import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectMongo } from './integrations/mongodb/mongoClient';
import { connectHubspot } from './integrations/hubspot/hubspotClient';

async function startServer() {
  await connectMongo();
  connectHubspot();
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

startServer(); 