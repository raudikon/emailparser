import express from 'express';

import { parseMailgunPayload } from '../services/emailParser.js';
import { insertEmail } from '../services/emailService.js';

export function registerWebhookRoutes(app) {
  const router = express.Router();

  router.post('/mailgun', async (req, res) => {
    try {
      const payload = req.body;

      const sender = payload.sender ?? payload.From ?? 'unknown@unknown';
      const recipient = payload.recipient ?? payload.To ?? 'unknown@unknown';
      const subject = payload.subject ?? payload.Subject ?? '(no subject)';
      const timestamp = payload.timestamp
        ? new Date(Number(payload.timestamp) * 1000)
        : new Date();

      const parsed = await parseMailgunPayload(payload);

      const imageUrls = parsed.attachments.map((attachment) => {
        const base64 = attachment.content.toString('base64');
        return `data:${attachment.contentType};base64,${base64}`;
      });

      await insertEmail({
        sender,
        recipient,
        subject,
        receivedAt: timestamp.toISOString(),
        rawText: parsed.text || parsed.html,
        textContent: parsed.text,
        imageUrls
      });

      res.status(204).end();
    } catch (error) {
      console.error('Mailgun webhook error:', error);
      res.status(400).json({ error: 'Failed to ingest email' });
    }
  });

  app.use('/api/webhooks', router);
}
