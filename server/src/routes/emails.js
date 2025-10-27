import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import { listEmails } from '../services/emailService.js';
import { getUserOrganization } from '../services/organizationService.js';

export function registerEmailRoutes(app) {
  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
    try {
      // Get user's organization
      const organization = await getUserOrganization(req.user.id);

      if (!organization) {
        return res.status(403).json({
          error: 'User not assigned to any organization'
        });
      }

      // List emails filtered by user's organization
      const emails = await listEmails(organization.id);
      res.json({ data: emails });
    } catch (error) {
      console.error('Failed to list emails:', error);
      res.status(500).json({ error: 'Failed to fetch emails' });
    }
  });

  app.use('/api/emails', router);
}
