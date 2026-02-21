const cron = require('node-cron');
const { runDailyGeneration } = require('../services/generator');
const { notify } = require('../services/telegram');

/**
 * Runs daily at 9:00 AM UTC.
 * Cron syntax: minute hour day month weekday
 */
function startGenerateCron() {
  const schedule = process.env.GENERATE_CRON || '0 9 * * *';

  cron.schedule(schedule, async () => {
    console.log('[Cron] Running daily post generation...');
    try {
      const post = await runDailyGeneration();
      if (post) {
        console.log(`[Cron] Post generated: ${post.id}`);
      } else {
        console.log('[Cron] No post generated (already exists for today)');
      }
    } catch (err) {
      console.error('[Cron] Generation failed:', err.message);
      await notify(`❌ Daily post generation failed: ${err.message}`).catch(() => {});
    }
  });

  console.log(`[Cron] Post generation scheduled: ${schedule}`);
}

module.exports = { startGenerateCron };
