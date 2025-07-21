import { Router } from 'express';
import twilioWebhookRouter from '../integrations/twilio/twilioWebhook';

const router = Router();

router.use('/twilio', twilioWebhookRouter);

export default router; 