import express from 'express';
import multer from 'multer';

import { parseMailgunPayload } from '../services/emailParser.js';
import { insertEmail } from '../services/emailService.js';
import { getOrganizationByRecipient } from '../services/organizationService.js';

const upload = multer();

export function registerWebhookRoutes(app) {
  const router = express.Router();

  router.post('/mailgun', upload.any(), async (req, res) => {
    try {
      const payload = req.body;
      const files = req.files || [];

      console.log('=== MAILGUN PAYLOAD ===');
      console.log('Available keys:', Object.keys(payload));
      console.log('Files count:', files.length);
      if (files.length > 0) {
        console.log('Files:', files.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, mimetype: f.mimetype, size: f.size })));
      }
      console.log('Full payload:', JSON.stringify(payload, null, 2));
      console.log('=====================');

      const sender = payload.sender ?? payload.From ?? 'unknown@unknown';
      const recipient = payload.recipient ?? payload.To ?? 'unknown@unknown';
      const subject = payload.subject ?? payload.Subject ?? '(no subject)';
      const timestamp = payload.timestamp
        ? new Date(Number(payload.timestamp) * 1000)
        : new Date();

      // Look up organization by recipient email
      const organization = await getOrganizationByRecipient(recipient);

      if (!organization) {
        console.error(`No organization found for recipient: ${recipient}`);
        return res.status(400).json({
          error: 'No organization found for this recipient address'
        });
      }

      console.log(`Email matched to organization: ${organization.name} (${organization.id})`);

      const parsed = await parseMailgunPayload(payload, files);

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
        imageUrls,
        organizationId: organization.id
      });

      res.status(204).end();
    } catch (error) {
      console.error('Mailgun webhook error:', error);
      res.status(400).json({ error: 'Failed to ingest email' });
    }
  });

  app.use('/api/webhooks', router);
}
