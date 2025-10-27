import cron from 'node-cron';

import { fetchEmailsForDateRange } from '../services/emailService.js';
import { storeGeneratedPosts } from '../services/postService.js';
import { generateInstagramCaptions } from '../services/aiGenerator.js';
import { listOrganizations } from '../services/organizationService.js';

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
      // Get all organizations
      const organizations = await listOrganizations();

      if (!organizations.length) {
        console.log('Daily post job: no organizations found, skipping.');
        return;
      }

      console.log(`Daily post job: processing ${organizations.length} organizations...`);

      // Process each organization separately
      for (const org of organizations) {
        try {
          const emails = await fetchEmailsForDateRange(start, end, org.id);

          if (!emails.length) {
            console.log(`Daily post job [${org.name}]: no emails for today, skipping.`);
            continue;
          }

          console.log(`Daily post job [${org.name}]: generating captions for ${emails.length} emails...`);

          const captions = await generateInstagramCaptions({
            emails,
            date: now
          });

          await storeGeneratedPosts(captions, org.id);
          console.log(`Daily post job [${org.name}]: stored ${captions.length} new captions.`);
        } catch (orgError) {
          console.error(`Daily post job [${org.name}] failed:`, orgError);
          // Continue processing other organizations even if one fails
        }
      }

      console.log('Daily post job: completed for all organizations.');
    } catch (error) {
      console.error('Daily post job failed:', error);
    }
  }, {
    timezone: process.env.CRON_TIMEZONE ?? 'UTC'
  });
}
