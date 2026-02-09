require('dotenv').config();
const SlackNotifier = require('./slack-notifier');

/**
 * Test script to verify Slack integration
 */
async function testSlackNotification() {
  console.log('🧪 Testing Slack Notification Integration\n');
  
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.error('❌ SLACK_WEBHOOK_URL not found in .env file');
    console.log('\n💡 To set up Slack notifications:');
    console.log('   1. Create a Slack Incoming Webhook: https://api.slack.com/apps');
    console.log('   2. Add SLACK_WEBHOOK_URL=your_webhook_url to your .env file');
    console.log('   3. Run this test again\n');
    process.exit(1);
  }
  
  console.log('✅ Webhook URL found in .env');
  console.log(`   URL: ${webhookUrl.substring(0, 40)}...\n`);
  
  const slackNotifier = new SlackNotifier(webhookUrl);
  
  // Test 1: Send test notification
  console.log('📤 Test 1: Sending test notification...');
  const testResult = await slackNotifier.sendTestNotification();
  
  if (testResult) {
    console.log('✅ Test notification sent successfully!\n');
  } else {
    console.log('❌ Test notification failed\n');
    process.exit(1);
  }
  
  // Test 2: Send sample job notification
  console.log('📤 Test 2: Sending sample job notification...');
  
  const sampleJobs = [
    {
      id: '1234567890',
      title: 'Shopify Expert Needed for Store Optimization',
      createdDateTime: new Date().toISOString(),
      description: 'We are looking for an experienced Shopify developer to help optimize our e-commerce store. The ideal candidate should have expertise in theme customization, app integration, and conversion rate optimization. This is a great opportunity to work with a growing brand in the wellness space.',
      url: 'https://www.upwork.com/jobs/~021234567890',
      hourlyBudgetMin: 50,
      hourlyBudgetMax: 100,
      duration: 'MONTH',
      client: {
        totalHires: 15,
        totalPostedJobs: 25,
        totalReviews: 12,
        location: {
          country: 'United States'
        }
      }
    },
    {
      id: '0987654321',
      title: 'E-Commerce Website Design and Development',
      createdDateTime: new Date(Date.now() - 3600000).toISOString(),
      description: 'Looking for a talented web designer and developer to create a modern, responsive e-commerce website. Must have experience with Shopify, user experience design, and mobile optimization.',
      url: 'https://www.upwork.com/jobs/~020987654321',
      amount: {
        rawValue: 5000
      },
      duration: 'ONGOING',
      client: {
        totalHires: 8,
        totalPostedJobs: 12,
        totalReviews: 7,
        location: {
          country: 'Canada'
        }
      }
    }
  ];
  
  const jobResult = await slackNotifier.notifyNewJobs(sampleJobs);
  
  if (jobResult.success) {
    console.log(`✅ Sample job notification sent successfully! (${jobResult.count} jobs)\n`);
  } else {
    console.log('❌ Sample job notification failed\n');
    process.exit(1);
  }
  
  console.log('🎉 All tests passed!');
  console.log('   Your Slack integration is working correctly.');
  console.log('   You should see 2 messages in your Slack channel.\n');
}

// Run the test
testSlackNotification().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
