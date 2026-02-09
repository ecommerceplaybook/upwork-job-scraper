const axios = require('axios');

/**
 * SlackNotifier - Sends formatted job notifications to Slack
 */
class SlackNotifier {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
    this.enabled = !!webhookUrl;
    
    if (!this.enabled) {
      console.log('⚠️  Slack notifications disabled (no webhook URL configured)');
    }
  }

  /**
   * Format a single job for Slack
   */
  formatJob(job) {
    const title = job.title || 'Untitled Job';
    const url = job.url || `https://www.upwork.com/jobs/~${job.id}`;
    const postedDate = job.createdDateTime 
      ? new Date(job.createdDateTime).toLocaleString() 
      : 'Unknown';
    
    // Format budget/rate
    let budget = '💰 Not specified';
    if (job.hourlyBudgetMin && job.hourlyBudgetMax) {
      budget = `💰 $${job.hourlyBudgetMin} - $${job.hourlyBudgetMax}/hr`;
    } else if (job.amount?.rawValue) {
      budget = `💰 $${job.amount.rawValue} (Fixed Price)`;
    } else if (job.weeklyBudget?.rawValue) {
      budget = `💰 $${job.weeklyBudget.rawValue}/week`;
    }
    
    // Format duration
    const duration = job.duration ? `⏱️ ${job.duration}` : '';
    
    // Format client info
    let clientInfo = '';
    if (job.client) {
      const hires = job.client.totalHires || 0;
      const jobs = job.client.totalPostedJobs || 0;
      const reviews = job.client.totalReviews || 0;
      const country = job.client.location?.country || 'Unknown';
      clientInfo = `👤 ${hires} hires • ${jobs} jobs • ${reviews} reviews • ${country}`;
    }
    
    // Truncate description
    let description = job.description || '';
    if (description.length > 300) {
      description = description.substring(0, 297) + '...';
    }
    
    // Remove excessive whitespace and newlines
    description = description.replace(/\s+/g, ' ').trim();
    
    return {
      title,
      url,
      postedDate,
      budget,
      duration,
      clientInfo,
      description
    };
  }

  /**
   * Create Slack message blocks for a single job
   */
  createJobBlocks(job) {
    const formatted = this.formatJob(job);
    
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: formatted.title,
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Posted:*\n${formatted.postedDate}`
          },
          {
            type: "mrkdwn",
            text: formatted.budget
          }
        ]
      }
    ];
    
    // Add duration and client info if available
    if (formatted.duration || formatted.clientInfo) {
      const fields = [];
      if (formatted.duration) {
        fields.push({
          type: "mrkdwn",
          text: formatted.duration
        });
      }
      if (formatted.clientInfo) {
        fields.push({
          type: "mrkdwn",
          text: formatted.clientInfo
        });
      }
      blocks.push({
        type: "section",
        fields
      });
    }
    
    // Add description
    if (formatted.description) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Description:*\n${formatted.description}`
        }
      });
    }
    
    // Add view job button
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Job on Upwork",
            emoji: true
          },
          url: formatted.url,
          style: "primary"
        }
      ]
    });
    
    // Add divider
    blocks.push({
      type: "divider"
    });
    
    return blocks;
  }

  /**
   * Send new jobs notification to Slack
   */
  async notifyNewJobs(jobs) {
    if (!this.enabled) {
      return { success: false, reason: 'Slack notifications disabled' };
    }

    if (!jobs || jobs.length === 0) {
      console.log('📭 No new jobs to notify about');
      return { success: true, count: 0 };
    }

    try {
      // Create header message
      const headerText = jobs.length === 1 
        ? '🎯 *1 New Upwork Job Found!*'
        : `🎯 *${jobs.length} New Upwork Jobs Found!*`;
      
      const blocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: headerText
          }
        },
        {
          type: "divider"
        }
      ];
      
      // Add each job (limit to 5 jobs per message due to Slack's 50 block limit)
      const jobsToSend = jobs.slice(0, 5);
      for (const job of jobsToSend) {
        blocks.push(...this.createJobBlocks(job));
      }
      
      // If there are more than 5 jobs, add a note
      if (jobs.length > 5) {
        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `_... and ${jobs.length - 5} more jobs. Check your server logs for details._`
            }
          ]
        });
      }
      
      // Send to Slack
      const response = await axios.post(this.webhookUrl, {
        blocks,
        text: `${jobs.length} new Upwork job${jobs.length === 1 ? '' : 's'} found!` // Fallback text
      });
      
      if (response.status === 200) {
        console.log(`✅ Slack notification sent successfully (${jobs.length} job${jobs.length === 1 ? '' : 's'})`);
        return { success: true, count: jobs.length };
      } else {
        console.error('❌ Slack notification failed:', response.status);
        return { success: false, reason: `HTTP ${response.status}` };
      }
      
    } catch (error) {
      console.error('❌ Failed to send Slack notification:', error.message);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Send a test notification
   */
  async sendTestNotification() {
    if (!this.enabled) {
      console.log('❌ Cannot send test - Slack notifications disabled');
      return false;
    }

    try {
      const response = await axios.post(this.webhookUrl, {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "✅ *Upwork Job Scraper Connected!*\n\nYour scraper is now monitoring Upwork and will send notifications for new jobs."
            }
          }
        ],
        text: "Upwork Job Scraper Connected!" // Fallback text
      });
      
      if (response.status === 200) {
        console.log('✅ Test Slack notification sent successfully');
        return true;
      } else {
        console.error('❌ Test notification failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to send test notification:', error.message);
      return false;
    }
  }
}

module.exports = SlackNotifier;
