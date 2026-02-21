const cron = require('node-cron');
const supabase = require('../db/supabase');
const { runDailyGeneration } = require('../services/generator');
const { notify } = require('../services/telegram');

// Holds the active cron task so we can stop and replace it on schedule changes
let currentTask = null;

const DEFAULT_SCHEDULE = '0 9 * * *';

/**
 * The job that runs on each tick.
 */
async function runJob() {
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
}

/**
 * Start (or restart) the cron task with the given schedule expression.
 * Stops the currently running task first if one exists.
 */
function restartCron(schedule) {
  if (!cron.validate(schedule)) {
    throw new Error(`Invalid cron expression: "${schedule}"`);
  }

  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  currentTask = cron.schedule(schedule, runJob);
  console.log(`[Cron] Post generation scheduled: ${schedule}`);
}

/**
 * Initialize the cron on startup.
 * Reads the schedule from app_config DB, falls back to env, then to default.
 */
async function startGenerateCron() {
  let schedule = DEFAULT_SCHEDULE;

  try {
    const { data: config } = await supabase
      .from('app_config')
      .select('generate_cron')
      .limit(1)
      .maybeSingle();

    if (config?.generate_cron) {
      schedule = config.generate_cron;
    } else if (process.env.GENERATE_CRON) {
      schedule = process.env.GENERATE_CRON;
    }
  } catch (err) {
    console.warn('[Cron] Could not read schedule from DB, using default:', err.message);
    schedule = process.env.GENERATE_CRON || DEFAULT_SCHEDULE;
  }

  restartCron(schedule);
}

module.exports = { startGenerateCron, restartCron };
