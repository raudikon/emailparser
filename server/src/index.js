import './config/env.js';

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { registerEmailRoutes } from './routes/emails.js';
import { registerPostRoutes } from './routes/posts.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerOrganizationRoutes } from './routes/organizations.js';
import { scheduleDailyPostJob } from './jobs/dailyPostJob.js';

const PORT = process.env.PORT ?? 3001;

async function bootstrap() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  registerWebhookRoutes(app);
  registerEmailRoutes(app);
  registerPostRoutes(app);
  registerOrganizationRoutes(app);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  scheduleDailyPostJob();

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
