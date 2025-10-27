import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import {
  createOrganization,
  assignUserToOrganization,
  getUserOrganization,
  isRecipientEmailAvailable
} from '../services/organizationService.js';

export function registerOrganizationRoutes(app) {
  const router = express.Router();

  /**
   * GET /api/organizations/me
   * Get current user's organization
   */
  router.get('/me', requireAuth, async (req, res) => {
    try {
      const organization = await getUserOrganization(req.user.id);

      if (!organization) {
        return res.status(404).json({
          error: 'User not assigned to any organization'
        });
      }

      res.json({ data: organization });
    } catch (error) {
      console.error('Failed to get user organization:', error);
      res.status(500).json({ error: 'Failed to fetch organization' });
    }
  });

  /**
   * POST /api/organizations
   * Create a new organization and assign current user as owner
   */
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { name, recipientEmail } = req.body;

      // Validate input
      if (!name || !recipientEmail) {
        return res.status(400).json({
          error: 'Name and recipient email are required'
        });
      }

      // Check if user already belongs to an organization
      const existingOrg = await getUserOrganization(req.user.id);
      if (existingOrg) {
        return res.status(400).json({
          error: 'User already belongs to an organization'
        });
      }

      // Check if email is available
      const available = await isRecipientEmailAvailable(recipientEmail);
      if (!available) {
        return res.status(400).json({
          error: 'This recipient email is already taken'
        });
      }

      // Create organization
      const organization = await createOrganization({ name, recipientEmail });

      // Assign user as owner
      await assignUserToOrganization({
        userId: req.user.id,
        organizationId: organization.id,
        role: 'owner'
      });

      res.status(201).json({ data: organization });
    } catch (error) {
      console.error('Failed to create organization:', error);
      res.status(500).json({
        error: error.message || 'Failed to create organization'
      });
    }
  });

  /**
   * POST /api/organizations/check-email
   * Check if recipient email is available
   */
  router.post('/check-email', requireAuth, async (req, res) => {
    try {
      const { recipientEmail } = req.body;

      if (!recipientEmail) {
        return res.status(400).json({
          error: 'Recipient email is required'
        });
      }

      const available = await isRecipientEmailAvailable(recipientEmail);

      res.json({ available });
    } catch (error) {
      console.error('Failed to check email availability:', error);
      res.status(500).json({ error: 'Failed to check email availability' });
    }
  });

  app.use('/api/organizations', router);
}
