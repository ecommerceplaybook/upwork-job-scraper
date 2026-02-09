require('dotenv').config();
const OpenAI = require('openai');

/**
 * OpenAIQualifier - Intelligently vets Upwork jobs using GPT-4o-mini
 * Implements a 3-tier qualification system:
 * - Tier 1: Ideal match (always accept)
 * - Tier 2: Upsell potential (accept)
 * - Tier 3: Hard reject (filter out)
 */
class OpenAIQualifier {
  constructor(apiKey) {
    if (!apiKey) {
      console.warn('⚠️  OpenAI API key not provided. Qualification disabled.');
      this.enabled = false;
      return;
    }
    
    this.client = new OpenAI({ apiKey });
    this.enabled = true;
    this.model = 'gpt-4o-mini';
    this.timeout = 5000; // 5 seconds
    
    // Your Upwork profile for context
    this.yourProfile = `Shopify CRO/Developer for Meta-Driven Brands Scaling Ad Spend

I help Shopify brands doing $100k+/month on Meta ads align their marketing message and customer journey — starting with the PDP — so they can scale ad spend without destroying efficiency.

Target clients:
- Shopify brands doing $100k+/month (ideal)
- Any Shopify development, migration, or design work (good fit)
- Scaling Meta/Facebook ads with increasing CPAs/CACs
- Need conversion optimization, PDP redesign, A/B testing
- Want to optimize before increasing ad spend
- Established brands with traction

Core services offered:
- Shopify CRO and conversion optimization
- Shopify development (themes, apps, customizations)
- Shopify migrations (platform migrations, redesigns)
- Shopify design (UI/UX, theme design, store design)

NOT a fit:
- Brand-new stores without revenue
- Dropshipping without traction
- Non-Shopify platforms (WordPress, WIX, Squarespace, etc.)
- Generic VA work`;
  }

  /**
   * Create the system prompt for job qualification
   */
  getSystemPrompt() {
    return `You are a job qualification assistant for a Shopify CRO expert. Your task is to evaluate Upwork job postings and classify them into 3 tiers:

**TIER 1 - Ideal Match (Always Accept)**
- Shopify brands doing $100k+/month or similar high revenue indicators
- Meta/Facebook ads scaling challenges, CPA/CAC optimization
- CRO, conversion optimization, PDP redesign, A/B testing
- Message-match optimization, customer journey work
- Budget: $50+/hr or $500+ fixed price

**TIER 2 - Upsell Potential (Accept)**
- Shopify development work (theme customization, app integration, functionality builds)
- Shopify migrations (from other platforms to Shopify, or Shopify redesigns/rebuilds)
- Shopify design projects (theme design, UI/UX improvements, store redesigns)
- Quick fixes on Shopify stores (can lead to larger projects)
- Klaviyo email marketing (adjacent to CRO work)
- Smaller CRO projects ($30-50/hr or $200-500 fixed)
- Established brands needing help (even if smaller initial scope)
- Reasonable client history (not necessarily high-value)
- Any Shopify work that could develop into ongoing relationship

**TIER 3 - Hard Reject (Filter Out)**
- Extremely low budgets with no growth potential ($5-20 fixed price, especially with minimal scope)
- Wrong niche: Non-ecommerce, non-Shopify platforms, WordPress, Wix, Squarespace, etc.
- Explicitly excluded: Dropshipping without traction, brand new stores with no revenue, generic VA work
- Spam, unclear, or completely irrelevant job descriptions
- Very high hire counts (200+) combined with extremely low budgets (suggests client churns through cheap freelancers)

**IMPORTANT:** Be generous with Tier 2. Even small Shopify jobs can lead to bigger opportunities. Focus on filtering out only the truly bad fits (Tier 3).

Respond ONLY with valid JSON in this exact format:
{"tier": 1, "reasoning": "Brief explanation"}

or

{"tier": 2, "reasoning": "Brief explanation"}

or

{"tier": 3, "reasoning": "Brief explanation"}`;
  }

  /**
   * Create the user prompt with job details
   */
  getUserPrompt(job) {
    // Format budget
    let budget = 'Not specified';
    if (job.hourlyBudgetMin?.rawValue && job.hourlyBudgetMax?.rawValue) {
      budget = `$${job.hourlyBudgetMin.rawValue}-${job.hourlyBudgetMax.rawValue}/hr`;
    } else if (job.amount?.rawValue) {
      budget = `$${job.amount.rawValue} fixed`;
    } else if (job.weeklyBudget?.rawValue) {
      budget = `$${job.weeklyBudget.rawValue}/week`;
    }
    
    // Build client info (note: Upwork API doesn't provide total spent data)
    const clientInfo = job.client ? `
Client Info:
- Total Hires: ${job.client.totalHires || 0}
- Total Jobs Posted: ${job.client.totalPostedJobs || 0}
- Location: ${job.client.location?.country || 'Unknown'}
- Reviews: ${job.client.totalReviews || 0}` : 'No client info available';

    return `Evaluate this Upwork job posting:

Title: ${job.title}

Budget: ${budget}

Duration: ${job.duration || 'Not specified'}

${clientInfo}

Description:
${job.description || 'No description provided'}

Should this job be accepted? Respond with JSON only.`;
  }

  /**
   * Qualify a single job using OpenAI
   */
  async qualifyJob(job) {
    if (!this.enabled) {
      return {
        qualified: true,
        tier: 0,
        reasoning: 'OpenAI disabled - allowing through',
        job
      };
    }

    try {
      const completion = await Promise.race([
        this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: this.getUserPrompt(job) }
          ],
          temperature: 0.3,
          max_tokens: 150,
          response_format: { type: "json_object" }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI request timeout')), this.timeout)
        )
      ]);

      const responseText = completion.choices[0].message.content;
      const result = JSON.parse(responseText);
      
      // Validate response
      if (!result.tier || ![1, 2, 3].includes(result.tier)) {
        throw new Error('Invalid tier in OpenAI response');
      }
      
      // Tier 1 and 2 are qualified, Tier 3 is rejected
      const qualified = result.tier === 1 || result.tier === 2;
      
      return {
        qualified,
        tier: result.tier,
        reasoning: result.reasoning || 'No reasoning provided',
        job
      };
      
    } catch (error) {
      console.error(`⚠️  OpenAI error for job "${job.title}": ${error.message}`);
      
      // Fail open - allow job through if OpenAI fails
      return {
        qualified: true,
        tier: 0,
        reasoning: `OpenAI unavailable (${error.message}) - allowing through unvetted`,
        job
      };
    }
  }

  /**
   * Qualify multiple jobs in parallel
   */
  async qualifyJobs(jobs) {
    if (!this.enabled) {
      console.log('⚠️  OpenAI qualification disabled - all jobs allowed through');
      return {
        qualified: jobs,
        rejected: [],
        stats: {
          total: jobs.length,
          qualified: jobs.length,
          rejected: 0,
          tier1: 0,
          tier2: 0,
          tier3: 0,
          unvetted: jobs.length
        }
      };
    }

    if (!jobs || jobs.length === 0) {
      return {
        qualified: [],
        rejected: [],
        stats: {
          total: 0,
          qualified: 0,
          rejected: 0,
          tier1: 0,
          tier2: 0,
          tier3: 0,
          unvetted: 0
        }
      };
    }

    console.log(`🤖 Qualifying ${jobs.length} job${jobs.length === 1 ? '' : 's'} with OpenAI GPT-4o-mini...`);
    
    const startTime = Date.now();
    
    // Process all jobs in parallel
    const results = await Promise.all(
      jobs.map(job => this.qualifyJob(job))
    );
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Separate qualified from rejected
    const qualified = results
      .filter(r => r.qualified)
      .map(r => ({
        ...r.job,
        tier: r.tier,
        reasoning: r.reasoning
      }));
    
    const rejected = results
      .filter(r => !r.qualified)
      .map(r => ({
        ...r.job,
        tier: r.tier,
        reasoning: r.reasoning
      }));
    
    // Calculate stats
    const stats = {
      total: jobs.length,
      qualified: qualified.length,
      rejected: rejected.length,
      tier1: results.filter(r => r.tier === 1).length,
      tier2: results.filter(r => r.tier === 2).length,
      tier3: results.filter(r => r.tier === 3).length,
      unvetted: results.filter(r => r.tier === 0).length,
      timeSeconds: parseFloat(elapsedTime),
      costEstimate: (jobs.length * 0.001).toFixed(4) // ~$0.001 per job
    };
    
    console.log(`✅ Qualification complete in ${elapsedTime}s (est. cost: $${stats.costEstimate})`);
    console.log(`   Tier 1 (Ideal): ${stats.tier1}`);
    console.log(`   Tier 2 (Upsell): ${stats.tier2}`);
    console.log(`   Tier 3 (Reject): ${stats.tier3}`);
    if (stats.unvetted > 0) {
      console.log(`   Unvetted (Error): ${stats.unvetted}`);
    }
    
    return {
      qualified,
      rejected,
      stats,
      results // Include full results for detailed logging
    };
  }
}

module.exports = OpenAIQualifier;
