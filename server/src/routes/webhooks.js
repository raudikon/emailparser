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

      // Mailgun sends various webhook events (delivery, bounces, etc.)
      // We only want to process actual incoming emails (stored messages)
      // Incoming emails have 'sender', 'recipient', and usually attachments or body content
      // Event webhooks have 'event-data' structure
      if (payload['event-data']) {
        // This is an event webhook (delivery, bounce, etc.), not an incoming email
        console.log('[Webhook] Ignoring event webhook:', payload['event-data']?.event);
        return res.status(200).json({ message: 'Event webhook ignored' });
      }

      // Check if this looks like an actual incoming email
      if (!payload.sender && !payload.From) {
        console.log('[Webhook] Ignoring webhook - no sender information');
        return res.status(200).json({ message: 'Not an incoming email' });
      }

      console.log('[Webhook] Received incoming email - Files:', files.length);

      const sender = payload.sender ?? payload.From ?? 'unknown@unknown';
      const recipient = payload.recipient ?? payload.To ?? 'unknown@unknown';
      const subject = payload.subject ?? payload.Subject ?? '(no subject)';
      const timestamp = payload.timestamp
        ? new Date(Number(payload.timestamp) * 1000)
        : new Date();

      console.log(`[Webhook] Processing email from: ${sender} to: ${recipient}`);

      // Look up organization by recipient email
      const organization = await getOrganizationByRecipient(recipient);

      if (!organization) {
        console.error(`No organization found for recipient: ${recipient}`);
        return res.status(400).json({
          error: 'No organization found for this recipient address'
        });
      }

      console.log(`[Webhook] Email matched to organization: ${organization.name} (${organization.id})`);

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

      console.log(`[Webhook] Email saved successfully to organization: ${organization.name}`);

      res.status(204).end();
    } catch (error) {
      console.error('Mailgun webhook error:', error);
      res.status(400).json({ error: 'Failed to ingest email' });
    }
  });

  app.use('/api/webhooks', router);
}
