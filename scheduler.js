require('dotenv').config();
const cron = require('node-cron');
const UpworkClient = require('./upwork-client');

// Get configuration from environment
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 */6 * * *'; // Default: every 6 hours
const SEARCH_KEYWORD = process.env.SEARCH_KEYWORD || 'Shopify';

/**
 * Validate cron schedule format
 */
function validateCronSchedule(schedule) {
  return cron.validate(schedule);
}

/**
 * Format next scheduled run time
 */
function getNextRunMessage(schedule) {
  const scheduleMap = {
    '0 */6 * * *': 'every 6 hours',
    '0 */3 * * *': 'every 3 hours',
    '0 */1 * * *': 'every hour',
    '*/30 * * * *': 'every 30 minutes',
    '*/15 * * * *': 'every 15 minutes',
    '0 9 * * *': 'daily at 9:00 AM',
    '0 9,15 * * *': 'daily at 9:00 AM and 3:00 PM',
    '0 9 * * 1-5': 'weekdays at 9:00 AM'
  };
  
  return scheduleMap[schedule] || 'on cron schedule: ' + schedule;
}

/**
 * Job execution function
 */
async function executeJobSearch() {
  const timestamp = new Date().toLocaleString();
  
  console.log('\n' + '█'.repeat(80));
  console.log(`🕐 Scheduled Job Run Started - ${timestamp}`);
  console.log('█'.repeat(80));
  
  try {
    const client = new UpworkClient();
    await client.run(SEARCH_KEYWORD);
    
    console.log(`✅ Job search completed successfully at ${new Date().toLocaleString()}`);
    console.log(`⏰ Next run: ${getNextRunMessage(CRON_SCHEDULE)}`);
    
  } catch (error) {
    console.error(`\n❌ Error during scheduled job run at ${timestamp}:`);
    console.error('   ', error.message);
    
    // Check if authentication is needed
    if (error.message.includes('No access token') || error.message.includes('No refresh token')) {
      console.error('\n⚠️  Authentication required!');
      console.error('   Please run: npm run auth');
      console.error('   Then restart the scheduler: npm start\n');
      process.exit(1);
    }
  }
}

/**
 * Start the scheduler
 */
async function startScheduler() {
  console.log('\n🚀 Upwork Shopify Job Scraper');
  console.log('================================\n');
  
  // Validate environment variables
  if (!process.env.UPWORK_API_KEY || !process.env.UPWORK_API_SECRET) {
    console.error('❌ Missing required environment variables:');
    console.error('   UPWORK_API_KEY and UPWORK_API_SECRET must be set in .env file');
    process.exit(1);
  }
  
  if (!process.env.UPWORK_ACCESS_TOKEN || !process.env.UPWORK_REFRESH_TOKEN) {
    console.error('❌ Missing authentication tokens:');
    console.error('   Please run: npm run auth');
    console.error('   This will authenticate with Upwork and save your tokens.\n');
    process.exit(1);
  }
  
  // Validate cron schedule
  if (!validateCronSchedule(CRON_SCHEDULE)) {
    console.error('❌ Invalid cron schedule format:', CRON_SCHEDULE);
    console.error('   Please check CRON_SCHEDULE in .env file');
    console.error('   Example: "0 */6 * * *" (every 6 hours)\n');
    process.exit(1);
  }
  
  console.log('⚙️  Configuration:');
  console.log(`   Search Keyword: "${SEARCH_KEYWORD}"`);
  console.log(`   Schedule: ${getNextRunMessage(CRON_SCHEDULE)}`);
  console.log(`   Cron Expression: ${CRON_SCHEDULE}`);
  console.log('');
  
  // Run immediately on start
  console.log('🏃 Running initial job search...\n');
  await executeJobSearch();
  
  // Schedule recurring jobs
  console.log('\n📅 Scheduler started. Waiting for next scheduled run...');
  console.log(`   Press Ctrl+C to stop the scheduler.\n`);
  
  cron.schedule(CRON_SCHEDULE, executeJobSearch, {
    scheduled: true,
    timezone: "America/New_York" // Change this to your timezone
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Scheduler stopped by user');
  console.log('   Goodbye!\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Scheduler stopped');
  process.exit(0);
});

// Start the scheduler
if (require.main === module) {
  startScheduler().catch((error) => {
    console.error('❌ Failed to start scheduler:', error.message);
    process.exit(1);
  });
}

module.exports = { startScheduler, executeJobSearch };
