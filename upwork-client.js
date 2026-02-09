require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const JobTracker = require('./job-tracker');

const GRAPHQL_ENDPOINT = 'https://api.upwork.com/graphql';
const TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token';

class UpworkClient {
  constructor() {
    this.clientId = process.env.UPWORK_API_KEY;
    this.clientSecret = process.env.UPWORK_API_SECRET;
    this.accessToken = process.env.UPWORK_ACCESS_TOKEN;
    this.refreshToken = process.env.UPWORK_REFRESH_TOKEN;
    
    // Support both SEARCH_KEYWORDS (comma-separated) and legacy SEARCH_KEYWORD
    if (process.env.SEARCH_KEYWORDS) {
      this.searchKeywords = process.env.SEARCH_KEYWORDS.split(',').map(k => k.trim());
    } else {
      this.searchKeywords = [process.env.SEARCH_KEYWORD || 'Shopify'];
    }
    
    this.filterCountries = process.env.FILTER_COUNTRIES 
      ? process.env.FILTER_COUNTRIES.split(',').map(c => c.trim())
      : null;
    
    // Initialize job tracker
    this.jobTracker = new JobTracker();
  }

  /**
   * Update .env file with new access token
   */
  updateAccessTokenInEnv(newAccessToken, newRefreshToken) {
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update access token
    if (envContent.includes('UPWORK_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /UPWORK_ACCESS_TOKEN=.*/,
        `UPWORK_ACCESS_TOKEN=${newAccessToken}`
      );
    }
    
    // Update refresh token
    if (envContent.includes('UPWORK_REFRESH_TOKEN=')) {
      envContent = envContent.replace(
        /UPWORK_REFRESH_TOKEN=.*/,
        `UPWORK_REFRESH_TOKEN=${newRefreshToken}`
      );
    }
    
    fs.writeFileSync(envPath, envContent);
    this.accessToken = newAccessToken;
    this.refreshToken = newRefreshToken;
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available. Please run: npm run auth');
    }

    try {
      console.log('🔄 Refreshing access token...');
      
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken
      });
      
      const response = await axios.post(TOKEN_URL, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });
      
      const { access_token, refresh_token } = response.data;
      
      // Update tokens in .env file
      this.updateAccessTokenInEnv(access_token, refresh_token);
      
      console.log('✅ Access token refreshed successfully');
      return access_token;
    } catch (error) {
      console.error('❌ Error refreshing access token:');
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      } else {
        console.error('   Message:', error.message);
      }
      throw new Error('Token refresh failed. You may need to re-authenticate: npm run auth');
    }
  }

  /**
   * Make a GraphQL request to Upwork API
   */
  async makeGraphQLRequest(query, variables = {}, retryOnAuthError = true) {
    if (!this.accessToken) {
      throw new Error('No access token available. Please run: npm run auth');
    }

    try {
      const response = await axios.post(
        GRAPHQL_ENDPOINT,
        {
          query,
          variables
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      // Check for GraphQL errors
      if (response.data.errors) {
        console.error('GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
        
        // Check if it's an auth error
        const hasAuthError = response.data.errors.some(err => 
          err.message && (
            err.message.includes('authentication') ||
            err.message.includes('Unauthorized') ||
            err.message.includes('token')
          )
        );
        
        if (hasAuthError && retryOnAuthError) {
          console.log('🔄 Authentication error detected, refreshing token and retrying...');
          await this.refreshAccessToken();
          return this.makeGraphQLRequest(query, variables, false); // Retry once
        }
        
        throw new Error(`GraphQL Error: ${response.data.errors[0].message}`);
      }

      return response.data;
    } catch (error) {
      // Handle 401 Unauthorized
      if (error.response && error.response.status === 401 && retryOnAuthError) {
        console.log('🔄 Access token expired, refreshing...');
        await this.refreshAccessToken();
        return this.makeGraphQLRequest(query, variables, false); // Retry once
      }
      
      throw error;
    }
  }

  /**
   * Search for jobs using GraphQL marketplace query (single keyword)
   */
  async searchJobsByKeyword(keyword, limit = 20) {
    console.log(`   🔍 Searching for "${keyword}"...`);
    
    // GraphQL query for marketplace job search with available fields
    const query = `
      query MarketplaceJobSearch(
        $titleExpression: String
        $searchType: MarketplaceJobPostingSearchType
        $sortAttributes: [MarketplaceJobPostingSearchSortAttribute]
      ) {
        marketplaceJobPostingsSearch(
          marketPlaceJobFilter: {
            titleExpression_eq: $titleExpression
          }
          searchType: $searchType
          sortAttributes: $sortAttributes
        ) {
          totalCount
          edges {
            node {
              id
              title
              createdDateTime
              description
              ciphertext
              weeklyBudget {
                rawValue
              }
              amount {
                rawValue
              }
              hourlyBudgetMin {
                rawValue
              }
              hourlyBudgetMax {
                rawValue
              }
              duration
              client {
                totalHires
                totalPostedJobs
                totalReviews
                totalCharges {
                  rawValue
                }
                paymentVerificationStatus
                location {
                  country
                }
              }
            }
          }
        }
      }
    `;
    
    const variables = {
      titleExpression: keyword,
      searchType: "USER_JOBS_SEARCH",
      sortAttributes: [{ field: "RECENCY" }]
    };
    
    try {
      const response = await this.makeGraphQLRequest(query, variables);
      
      if (!response.data || !response.data.marketplaceJobPostingsSearch) {
        throw new Error('Unexpected response format from Upwork API');
      }
      
      const jobsData = response.data.marketplaceJobPostingsSearch;
      
      // Filter by country if specified
      if (this.filterCountries && this.filterCountries.length > 0) {
        const originalCount = jobsData.totalCount;
        const filteredEdges = jobsData.edges.filter(edge => {
          const clientCountry = edge.node.client?.location?.country;
          return clientCountry && this.filterCountries.includes(clientCountry);
        });
        
        jobsData.edges = filteredEdges;
        jobsData.filteredCount = filteredEdges.length;
        jobsData.originalTotalCount = originalCount;
      }
      
      return jobsData;
    } catch (error) {
      console.error('❌ Error searching jobs:');
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('   Message:', error.message);
      }
      throw error;
    }
  }

  /**
   * Format and display job results
   */
  displayJobs(jobsData, processedData) {
    const { totalCount, edges, filteredCount } = jobsData;
    
    console.log('\n' + '='.repeat(80));
    
    if (processedData) {
      // Show new jobs only
      if (processedData.newJobs === 0) {
        console.log(`📊 SEARCH RESULTS - No new jobs found`);
        if (processedData.oldJobsFiltered > 0) {
          console.log(`   ⏱️  ${processedData.oldJobsFiltered} older jobs filtered (not recently posted)`);
        }
        console.log(`   ${processedData.alreadySeen} jobs already seen (filtered out)`);
      } else if (processedData.newJobs === 1) {
        console.log(`📊 SEARCH RESULTS - 1 NEW job found! 🎉`);
        if (processedData.oldJobsFiltered > 0) {
          console.log(`   ⏱️  ${processedData.oldJobsFiltered} older jobs filtered (not recently posted)`);
        }
        console.log(`   ${processedData.alreadySeen} jobs already seen (filtered out)`);
      } else {
        console.log(`📊 SEARCH RESULTS - ${processedData.newJobs} NEW jobs found! 🎉`);
        if (processedData.oldJobsFiltered > 0) {
          console.log(`   ⏱️  ${processedData.oldJobsFiltered} older jobs filtered (not recently posted)`);
        }
        console.log(`   ${processedData.alreadySeen} jobs already seen (filtered out)`);
      }
    } else {
      console.log(`📊 SEARCH RESULTS - ${filteredCount || edges.length} unique jobs found`);
    }
    
    if (this.searchKeywords.length > 1) {
      console.log(`🔍 Keywords: ${this.searchKeywords.join(', ')}`);
    }
    if (this.filterCountries && this.filterCountries.length > 0) {
      console.log(`🌎 Location filter: ${this.filterCountries.join(', ')}`);
    }
    
    // Show tracker stats
    const stats = this.jobTracker.getStats();
    console.log(`📝 Tracking ${stats.totalTracked} jobs (auto-cleanup after 48 hours)`);
    
    console.log('='.repeat(80) + '\n');
    
    if (!edges || edges.length === 0) {
      console.log('   ✨ All caught up! Check back in 10 minutes for new postings.\n');
      return;
    }
    
    edges.forEach((edge, index) => {
      const job = edge.node;
      
      console.log(`\n🔹 Job #${index + 1}`);
      console.log(`   Title: ${job.title}`);
      console.log(`   ID: ${job.id}`);
      console.log(`   Posted: ${new Date(job.createdDateTime).toLocaleString()}`);
      
      // Build proper URL - ciphertext already has the ~ prefix
      const jobUrl = job.ciphertext 
        ? `https://www.upwork.com/jobs/${job.ciphertext}`
        : `https://www.upwork.com/jobs/~${job.id}`;
      console.log(`   URL: ${jobUrl}`);
      
      // Budget/Rate information
      if (job.hourlyBudgetMin?.rawValue || job.hourlyBudgetMax?.rawValue) {
        const min = job.hourlyBudgetMin?.rawValue || 'Not specified';
        const max = job.hourlyBudgetMax?.rawValue || 'Not specified';
        console.log(`   💰 Rate: $${min} - $${max}/hr`);
      } else if (job.amount?.rawValue) {
        console.log(`   💰 Budget: $${job.amount.rawValue} (Fixed Price)`);
      } else if (job.weeklyBudget?.rawValue) {
        console.log(`   💰 Weekly Budget: $${job.weeklyBudget.rawValue}`);
      }
      
      // Duration
      if (job.duration) {
        console.log(`   ⏱️  Duration: ${job.duration}`);
      }
      
      // Client info
      if (job.client) {
        const clientInfo = [];
        if (job.client.totalHires) clientInfo.push(`${job.client.totalHires} hires`);
        if (job.client.totalPostedJobs) clientInfo.push(`${job.client.totalPostedJobs} jobs posted`);
        if (job.client.totalReviews) clientInfo.push(`${job.client.totalReviews} reviews`);
        if (job.client.paymentVerificationStatus) clientInfo.push(`Payment: ${job.client.paymentVerificationStatus}`);
        if (job.client.location?.country) clientInfo.push(`From: ${job.client.location.country}`);
        
        if (clientInfo.length > 0) {
          console.log(`   👤 Client: ${clientInfo.join(' • ')}`);
        }
      }
      
      // Description (truncated)
      if (job.description) {
        const shortDesc = job.description.substring(0, 200).replace(/\n/g, ' ');
        console.log(`   📄 Description: ${shortDesc}...`);
      }
      
      console.log('   ' + '-'.repeat(76));
    });
    
    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Search for all configured keywords and combine results
   */
  async searchAllKeywords(limit = 20) {
    console.log(`\n🔍 Searching for jobs with ${this.searchKeywords.length} keyword(s) in parallel...`);
    
    // Run all searches in parallel
    const searchPromises = this.searchKeywords.map(async (keyword) => {
      try {
        const jobsData = await this.searchJobsByKeyword(keyword, limit);
        
        const resultCount = jobsData.edges?.length || 0;
        if (resultCount > 0) {
          console.log(`   ✓ "${keyword}": ${resultCount} jobs`);
        } else {
          console.log(`   ○ "${keyword}": No jobs`);
        }
        
        return jobsData;
      } catch (error) {
        console.log(`   ✗ "${keyword}": Error - ${error.message}`);
        return { edges: [], totalCount: 0 };
      }
    });
    
    // Wait for all searches to complete
    const results = await Promise.all(searchPromises);
    
    // Combine and deduplicate results
    const allJobs = new Map(); // Use Map to deduplicate by job ID
    let totalFetched = 0;
    
    results.forEach(jobsData => {
      if (jobsData.edges && jobsData.edges.length > 0) {
        jobsData.edges.forEach(edge => {
          if (!allJobs.has(edge.node.id)) {
            allJobs.set(edge.node.id, edge);
          }
        });
      }
      totalFetched += jobsData.totalCount || 0;
    });
    
    // Convert Map to array and sort by date (newest first)
    const sortedJobs = Array.from(allJobs.values()).sort((a, b) => {
      const dateA = new Date(a.node.createdDateTime);
      const dateB = new Date(b.node.createdDateTime);
      return dateB - dateA; // Descending order (newest first)
    });
    
    // Convert back to the expected format
    const combinedResults = {
      totalCount: totalFetched,
      filteredCount: sortedJobs.length,
      edges: sortedJobs
    };
    
    return combinedResults;
  }

  /**
   * Main method to search and display jobs
   */
  async run() {
    try {
      const jobsData = await this.searchAllKeywords();
      
      // Process jobs through tracker (filter new, mark as seen)
      const processedData = this.jobTracker.processJobs(jobsData.edges);
      
      // Update edges to only show new jobs
      jobsData.edges = processedData.jobs;
      
      // Display results
      this.displayJobs(jobsData, processedData);
      
      return {
        ...jobsData,
        processed: processedData
      };
    } catch (error) {
      console.error('\n❌ Failed to fetch jobs:', error.message);
      throw error;
    }
  }
}

// Export the class
module.exports = UpworkClient;

// Allow running directly for testing
if (require.main === module) {
  const client = new UpworkClient();
  client.run()
    .then(() => {
      console.log('✅ Job search completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Job search failed:', error.message);
      process.exit(1);
    });
}
