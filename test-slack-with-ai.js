require('dotenv').config();
const SlackNotifier = require('./slack-notifier');

/**
 * Test Slack notifications with AI reasoning
 */

// Sample qualified jobs with AI tier and reasoning
const sampleJobs = [
  {
    id: 'test1',
    title: 'Shopify CRO Expert Needed - Scaling Meta Ads from $10k to $50k/day',
    description: 'We\'re a 7-figure supplement brand doing $300k/month on Shopify. Our Meta ads are performing well at $10k/day spend, but as we scale to $50k/day, our CPA is increasing from $30 to $65. We need an expert to optimize our product pages for cold traffic and improve conversion rate through A/B testing.',
    amount: { rawValue: 5000 },
    duration: 'More than 6 months',
    createdDateTime: new Date().toISOString(),
    client: {
      totalHires: 45,
      totalPostedJobs: 52,
      totalReviews: 38,
      totalCharges: { rawValue: 125000 },
      paymentVerificationStatus: 'VERIFIED',
      location: { country: 'United States' }
    },
    ciphertext: '~test1',
    url: 'https://www.upwork.com/jobs/~test1',
    tier: 1,
    reasoning: '7-figure supplement brand with clear Meta ads scaling challenge. Budget $5000 indicates serious investment. Perfect match for high-value CRO work.'
  },
  {
    id: 'test2',
    title: 'Quick Shopify Speed Optimization Needed',
    description: 'Our Shopify store is loading slowly and it\'s affecting conversions. Need someone to optimize images and code, improve page speed scores, and fix mobile loading issues. We\'re doing about $50k/month and want to grow.',
    amount: { rawValue: 400 },
    duration: 'Less than 1 month',
    createdDateTime: new Date().toISOString(),
    client: {
      totalHires: 8,
      totalPostedJobs: 10,
      totalReviews: 7,
      totalCharges: { rawValue: 12000 },
      paymentVerificationStatus: 'VERIFIED',
      location: { country: 'Canada' }
    },
    ciphertext: '~test2',
    url: 'https://www.upwork.com/jobs/~test2',
    tier: 2,
    reasoning: 'Quick fix project with reasonable budget. Client doing $50k/month shows growth potential. Could lead to larger CRO projects.'
  }
];

async function testSlackWithAI() {
  console.log('🧪 Testing Slack Notifications with AI Reasoning\n');
  console.log('='.repeat(80));
  
  if (!process.env.SLACK_WEBHOOK_URL) {
    console.error('❌ SLACK_WEBHOOK_URL not found in .env file');
    console.error('   Please add your Slack webhook URL to continue.\n');
    process.exit(1);
  }
  
  console.log('✅ Slack webhook URL found');
  console.log('📋 Sending 2 sample jobs with AI reasoning...\n');
  console.log('='.repeat(80) + '\n');
  
  const slackNotifier = new SlackNotifier(process.env.SLACK_WEBHOOK_URL);
  
  try {
    const result = await slackNotifier.notifyNewJobs(sampleJobs);
    
    if (result.success) {
      console.log('✅ Slack notification sent successfully!\n');
      console.log('Check your Slack channel to see:');
      console.log('  🎯 TIER 1 badge for the ideal match');
      console.log('  💡 TIER 2 badge for the upsell opportunity');
      console.log('  💭 AI Insight showing the reasoning\n');
      console.log('='.repeat(80));
      console.log('✅ Test completed!\n');
    } else {
      console.error('❌ Slack notification failed:', result.reason);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testSlackWithAI();
}
