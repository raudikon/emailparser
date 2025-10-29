import express from 'express';
import multer from 'multer';

import { parseMailgunPayload } from '../services/emailParser.js';
import { insertEmail } from '../services/emailService.js';
import { getOrganizationByRecipient } from '../services/organizationService.js';
import { uploadImage } from '../services/imageStorageService.js';

const upload = multer();

export function registerWebhookRoutes(app) {
  const router = express.Router();

  router.post('/mailgun', upload.any(), async (req, res) => {
    try {
      const payload = req.body;
      const files = req.files || [];

      console.log('[Webhook] Received email - Files:', files.length);

      const sender = payload.sender ?? payload.From ?? 'unknown@unknown';
      const recipient = payload.recipient ?? payload.To ?? 'unknown@unknown';
      const subject = payload.subject ?? payload.Subject ?? '(no subject)';
      const timestamp = payload.timestamp
        ? new Date(Number(payload.timestamp) * 1000)
        : new Date();

      console.log(`[Webhook] Extracted recipient email: "${recipient}"`);
      console.log(`[Webhook] Looking up organization for: "${recipient}"`);

      // Look up organization by recipient email
      const organization = await getOrganizationByRecipient(recipient);

      console.log(`[Webhook] Organization lookup result:`, organization ? `Found: ${organization.name} (${organization.id})` : 'NOT FOUND');

      if (!organization) {
        console.error(`No organization found for recipient: ${recipient}`);
        return res.status(400).json({
          error: 'No organization found for this recipient address'
        });
      }

      console.log(`Email matched to organization: ${organization.name} (${organization.id})`);

      const parsed = await parseMailgunPayload(payload, files);

      // Upload images to Supabase Storage and get public URLs
      const imageUrls = await Promise.all(
        parsed.attachments.map(async (attachment) => {
          try {
            const publicUrl = await uploadImage(
              attachment.content,
              attachment.contentType,
              organization.id
            );
            console.log(`[Webhook] Uploaded image: ${publicUrl}`);
            return publicUrl;
          } catch (error) {
            console.error('[Webhook] Failed to upload image:', error);
            // Fallback to base64 if upload fails
            const base64 = attachment.content.toString('base64');
            return `data:${attachment.contentType};base64,${base64}`;
          }
        })
      );

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
