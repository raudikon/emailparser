import cron from 'node-cron';

import { fetchEmailsForDateRange } from '../services/emailService.js';
import { storeGeneratedPosts } from '../services/postService.js';
import { generateInstagramCaptions } from '../services/aiGenerator.js';

const DAILY_CRON = process.env.DAILY_CRON ?? '0 22 * * *'; // default: 10pm UTC daily

export function scheduleDailyPostJob() {
  if (!process.env.CLAUDE_API_KEY) {
    console.warn('Daily post job disabled: missing CLAUDE_API_KEY.');
    return;
  }

  cron.schedule(DAILY_CRON, async () => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    try {
      const emails = await fetchEmailsForDateRange(start, end);

      if (!emails.length) {
        console.log('Daily post job: no emails for today, skipping caption generation.');
        return;
      }

      const captions = await generateInstagramCaptions({
        emails,
        date: now
      });

      await storeGeneratedPosts(captions);
      console.log(`Daily post job: stored ${captions.length} new captions.`);
    } catch (error) {
      console.error('Daily post job failed:', error);
    }
  }, {
    timezone: process.env.CRON_TIMEZONE ?? 'UTC'
  });
}
