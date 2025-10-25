import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import { listDailyPosts } from '../services/postService.js';

export function registerPostRoutes(app) {
  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
    try {
      const posts = await listDailyPosts();
      res.json({ data: posts });
    } catch (error) {
      console.error('Failed to list posts:', error);
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  });

  app.use('/api/daily-posts', router);
}
