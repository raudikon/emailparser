import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import { listEmails } from '../services/emailService.js';

export function registerEmailRoutes(app) {
  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
    try {
      const emails = await listEmails();
      res.json({ data: emails });
    } catch (error) {
      console.error('Failed to list emails:', error);
      res.status(500).json({ error: 'Failed to fetch emails' });
    }
  });

  app.use('/api/emails', router);
}
