import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import { listDailyPosts } from '../services/postService.js';
import { getUserOrganization } from '../services/organizationService.js';

export function registerPostRoutes(app) {
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

      // List posts filtered by user's organization
      const posts = await listDailyPosts(organization.id);
      res.json({ data: posts });
    } catch (error) {
      console.error('Failed to list posts:', error);
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  });

  app.use('/api/daily-posts', router);
}
