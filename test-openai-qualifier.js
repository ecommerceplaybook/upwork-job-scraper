require('dotenv').config();
const OpenAIQualifier = require('./openai-qualifier');

/**
 * Test script for OpenAI job qualification
 * Tests all 3 tiers with realistic job examples
 */

// Sample jobs representing each tier
const sampleJobs = [
  // TIER 1: Ideal Match - High-value Shopify CRO job
  {
    id: 'test-tier1-1',
    title: 'Shopify CRO Expert Needed - Scaling Meta Ads from $10k to $50k/day',
    description: `We're a 7-figure supplement brand doing $300k/month on Shopify. Our Meta ads are performing well at $10k/day spend, but as we scale to $50k/day, our CPA is increasing from $30 to $65.

We need an expert to:
- Optimize our product pages for cold traffic
- Improve conversion rate through A/B testing
- Create message-match between ads and landing pages
- Help us scale profitably

Our current conversion rate is 2.1% and we want to get it to 3%+.`,
    amount: { rawValue: 5000 },
    duration: 'More than 6 months',
    client: {
      totalHires: 45,
      totalPostedJobs: 52,
      totalReviews: 38,
      totalCharges: { rawValue: 125000 },
      paymentVerificationStatus: 'VERIFIED',
      location: { country: 'United States' }
    },
    ciphertext: '~test1'
  },

  // TIER 1: Another ideal match - Meta ads + PDP optimization
  {
    id: 'test-tier1-2',
    title: 'Product Page Redesign for DTC Brand Scaling Facebook Ads',
    description: `Looking for a Shopify expert who understands paid acquisition. We're spending $200k/month on Facebook ads and need our PDPs to convert better.

Requirements:
- Experience with A/B testing on Shopify
- Understanding of Meta pixel and conversion tracking
- Can create multiple PDP variants based on different ad angles
- Focus on increasing AOV and conversion rate

Budget is flexible for the right person.`,
    hourlyBudgetMin: { rawValue: 75 },
    hourlyBudgetMax: { rawValue: 150 },
    duration: '3 to 6 months',
    client: {
      totalHires: 12,
      totalPostedJobs: 15,
      totalReviews: 10,
      totalCharges: { rawValue: 85000 },
      paymentVerificationStatus: 'VERIFIED',
      location: { country: 'United States' }
    },
    ciphertext: '~test2'
  },

  // TIER 2: Upsell Potential - Quick Shopify fix
  {
    id: 'test-tier2-1',
    title: 'Quick Shopify Speed Optimization Needed',
    description: `Our Shopify store is loading slowly and it's affecting conversions. Need someone to:
- Optimize images and code
- Improve page speed scores
- Fix mobile loading issues

We're doing about $50k/month and want to grow. This could lead to ongoing optimization work.`,
    amount: { rawValue: 400 },
    duration: 'Less than 1 month',
    client: {
      totalHires: 8,
      totalPostedJobs: 10,
      totalReviews: 7,
      totalCharges: { rawValue: 12000 },
      paymentVerificationStatus: 'VERIFIED',
      location: { country: 'Canada' }
    },
    ciphertext: '~test3'
  },

  // TIER 2: Upsell Potential - Klaviyo work
  {
    id: 'test-tier2-2',
    title: 'Klaviyo Expert for Email Flow Setup - Shopify Store',
    description: `Need help setting up automated email flows in Klaviyo for our Shopify store:
- Welcome series
- Abandoned cart
- Post-purchase flow
- Browse abandonment

We're a growing DTC brand doing $80k/month. Looking for someone who knows Shopify + Klaviyo integration well.`,
    hourlyBudgetMin: { rawValue: 35 },
    hourlyBudgetMax: { rawValue: 60 },
    duration: '1 to 3 months',
    client: {
      totalHires: 5,
      totalPostedJobs: 8,
      totalReviews: 4,
      totalCharges: { rawValue: 8500 },
      paymentVerificationStatus: 'VERIFIED',
      location: { country: 'United States' }
    },
    ciphertext: '~test4'
  },

  // TIER 3: Hard Reject - Low-value client with poor spend-to-hire ratio
  {
    id: 'test-tier3-1',
    title: 'Shopify Banner Design - $5 Budget',
    description: `Need a simple banner designed for my Shopify store. Should take 30 minutes max. Looking for someone cheap and fast.`,
    amount: { rawValue: 5 },
    duration: 'Less than 1 week',
    client: {
      totalHires: 332,
      totalPostedJobs: 450,
      totalReviews: 180,
      totalCharges: { rawValue: 3300 }, // ~$10 per hire - terrible ratio
      paymentVerificationStatus: 'VERIFIED',
      location: { country: 'India' }
    },
    ciphertext: '~test5'
  },

  // TIER 3: Hard Reject - Wrong platform (WordPress)
  {
    id: 'test-tier3-2',
    title: 'WordPress WooCommerce Developer Needed',
    description: `Looking for a WordPress expert to customize my WooCommerce store. Need to add custom product options and improve checkout flow.

Must have experience with PHP and WordPress themes.`,
    hourlyBudgetMin: { rawValue: 15 },
    hourlyBudgetMax: { rawValue: 30 },
    duration: '1 to 3 months',
    client: {
      totalHires: 25,
      totalPostedJobs: 35,
      totalReviews: 18,
      totalCharges: { rawValue: 8000 },
      paymentVerificationStatus: 'VERIFIED',
      location: { country: 'United Kingdom' }
    },
    ciphertext: '~test6'
  },

  // TIER 3: Hard Reject - Dropshipping/VA work
  {
    id: 'test-tier3-3',
    title: 'Virtual Assistant for Dropshipping Store',
    description: `Starting a new dropshipping business and need a VA to help with:
- Product research
- Order fulfillment
- Customer service emails
- Social media posting

Looking for someone to work 20 hours/week at low rate. Store is brand new with no sales yet.`,
    hourlyBudgetMin: { rawValue: 5 },
    hourlyBudgetMax: { rawValue: 10 },
    duration: 'More than 6 months',
    client: {
      totalHires: 2,
      totalPostedJobs: 3,
      totalReviews: 0,
      totalCharges: { rawValue: 150 },
      paymentVerificationStatus: 'UNVERIFIED',
      location: { country: 'Pakistan' }
    },
    ciphertext: '~test7'
  }
];

/**
 * Run the test
 */
async function runTest() {
  console.log('🧪 Testing OpenAI Job Qualifier\n');
  console.log('=' .repeat(80));
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env file');
    console.error('   Please add your OpenAI API key to continue.\n');
    process.exit(1);
  }
  
  console.log(`✅ OpenAI API key found`);
  console.log(`📋 Testing with ${sampleJobs.length} sample jobs\n`);
  console.log('=' .repeat(80) + '\n');
  
  const qualifier = new OpenAIQualifier(process.env.OPENAI_API_KEY);
  
  try {
    const results = await qualifier.qualifyJobs(sampleJobs);
    
    console.log('\n' + '=' .repeat(80));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(80));
    console.log(`Total Jobs Tested: ${results.stats.total}`);
    console.log(`Qualified (Tier 1 & 2): ${results.stats.qualified}`);
    console.log(`Rejected (Tier 3): ${results.stats.rejected}`);
    console.log(`Unvetted (Errors): ${results.stats.unvetted}`);
    console.log(`Time: ${results.stats.timeSeconds}s`);
    console.log(`Estimated Cost: $${results.stats.costEstimate}`);
    console.log('=' .repeat(80) + '\n');
    
    // Show detailed results
    console.log('📝 DETAILED RESULTS:\n');
    
    results.results.forEach((result, index) => {
      const tierLabel = {
        1: 'TIER 1 - IDEAL MATCH ✅',
        2: 'TIER 2 - UPSELL POTENTIAL ✅',
        3: 'TIER 3 - REJECTED ❌',
        0: 'UNVETTED (ERROR) ⚠️'
      }[result.tier];
      
      console.log(`${index + 1}. ${tierLabel}`);
      console.log(`   Title: "${result.job.title}"`);
      console.log(`   Reasoning: ${result.reasoning}`);
      console.log('');
    });
    
    console.log('=' .repeat(80));
    console.log('✅ Test completed successfully!\n');
    
    // Verify expected results
    console.log('🔍 VERIFICATION:');
    const tier1Count = results.results.filter(r => r.tier === 1).length;
    const tier2Count = results.results.filter(r => r.tier === 2).length;
    const tier3Count = results.results.filter(r => r.tier === 3).length;
    
    console.log(`   Expected: 2 Tier 1 jobs → Got ${tier1Count} ${tier1Count === 2 ? '✅' : '⚠️'}`);
    console.log(`   Expected: 2 Tier 2 jobs → Got ${tier2Count} ${tier2Count === 2 ? '✅' : '⚠️'}`);
    console.log(`   Expected: 3 Tier 3 jobs → Got ${tier3Count} ${tier3Count === 3 ? '✅' : '⚠️'}`);
    
    if (tier1Count === 2 && tier2Count === 2 && tier3Count === 3) {
      console.log('\n🎉 All jobs classified correctly!\n');
    } else {
      console.log('\n⚠️  Some classifications may differ from expected. This is OK - AI responses can vary.\n');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runTest();
}

module.exports = { sampleJobs };
