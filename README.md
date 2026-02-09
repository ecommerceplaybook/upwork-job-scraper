# Upwork Shopify Job Scraper

A Node.js server application that automatically pulls Shopify-related jobs from the Upwork API using GraphQL and displays them in the console on a scheduled basis.

## Features

- 🔐 OAuth2 authentication with Upwork API
- 🔍 Search jobs by keyword (default: "Shopify")
- ⏰ Scheduled job pulling using cron expressions
- 🔄 Automatic token refresh
- 📊 Formatted console output with job details
- 🚀 Easy setup with automated authentication flow

## Prerequisites

- Node.js (v14 or higher)
- npm
- Upwork API credentials (Client ID and Client Secret)
- Active Upwork account

## Installation

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your environment variables**
   
   Your `.env` file should already contain:
   ```env
   UPWORK_API_KEY=your_client_id_here
   UPWORK_API_SECRET=your_client_secret_here
   UPWORK_REDIRECT_URI=http://localhost:3000/callback
   UPWORK_ACCESS_TOKEN=
   UPWORK_REFRESH_TOKEN=
   CRON_SCHEDULE=0 */6 * * *
   SEARCH_KEYWORD=Shopify
   ```

## Setup Instructions

### Step 1: Configure Callback URL in Upwork

Before running the authentication, you must set up the callback URL in your Upwork API key settings:

1. Visit [https://www.upwork.com/developer/keys/](https://www.upwork.com/developer/keys/)
2. Log in with your Upwork account
3. Click on your API key (the one matching your credentials in `.env`)
4. Find the "Callback URL" or "Redirect URI" field
5. Set it to: `http://localhost:3000/callback`
6. Save the changes

**Important:** The callback URL must match exactly what's in your `.env` file.

### Step 2: First-Time Authentication

Run the authentication script to obtain access tokens:

```bash
npm run auth
```

This will:
1. Start a temporary local server on port 3000
2. Open your browser to the Upwork authorization page
3. Prompt you to click "Authorize" to grant access
4. Automatically capture the authorization code
5. Exchange it for access and refresh tokens
6. Save the tokens to your `.env` file
7. Shut down the local server

**Note:** This is a one-time setup. The tokens will be automatically refreshed as needed.

### Step 3: Start the Scheduler

Once authenticated, start the scheduled job scraper:

```bash
npm start
```

The scheduler will:
- Run an initial job search immediately
- Continue to search for jobs based on your cron schedule
- Display results in the console
- Automatically refresh access tokens when needed

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `UPWORK_API_KEY` | Your Upwork Client ID | (required) |
| `UPWORK_API_SECRET` | Your Upwork Client Secret | (required) |
| `UPWORK_REDIRECT_URI` | OAuth callback URL | `http://localhost:3000/callback` |
| `UPWORK_ACCESS_TOKEN` | Access token (auto-populated) | - |
| `UPWORK_REFRESH_TOKEN` | Refresh token (auto-populated) | - |
| `CRON_SCHEDULE` | Cron expression for scheduling | `0 */6 * * *` |
| `SEARCH_KEYWORDS` | Comma-separated keywords to search | `Shopify` |
| `FILTER_COUNTRIES` | Comma-separated country filters | `United States,USA,Canada,CAN` |
| `SLACK_WEBHOOK_URL` | Slack webhook URL for notifications | (optional) |
| `OPENAI_API_KEY` | OpenAI API key for AI job qualification | (optional) |

### Cron Schedule Examples

| Schedule | Description |
|----------|-------------|
| `0 */6 * * *` | Every 6 hours (default) |
| `0 */3 * * *` | Every 3 hours |
| `0 */1 * * *` | Every hour |
| `*/30 * * * *` | Every 30 minutes |
| `0 9 * * *` | Daily at 9:00 AM |
| `0 9,15 * * *` | Daily at 9:00 AM and 3:00 PM |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |

Learn more about cron expressions: [crontab.guru](https://crontab.guru/)

### Slack Notifications Setup (Optional)

Get real-time notifications in Slack whenever new Upwork jobs are found.

#### Step 1: Create a Slack Incoming Webhook

1. Go to your Slack workspace
2. Visit [https://api.slack.com/apps](https://api.slack.com/apps)
3. Click "Create New App" → "From scratch"
4. Name your app (e.g., "Upwork Job Notifier") and select your workspace
5. Click "Create App"
6. In the left sidebar, click "Incoming Webhooks"
7. Toggle "Activate Incoming Webhooks" to **On**
8. Click "Add New Webhook to Workspace"
9. Select the channel where you want notifications (e.g., `#upwork`)
10. Click "Allow"
11. Copy the webhook URL (looks like: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX`)

#### Step 2: Add Webhook to Environment

1. Open your `.env` file
2. Add the webhook URL:
   ```env
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```
3. Save the file
4. Restart your scheduler: `pm2 restart upwork-scraper` (on server) or `npm start` (locally)

#### Features

When Slack notifications are enabled, you'll receive:
- 📊 Summary of new jobs found
- 💼 Job title and posted date
- 💰 Budget/rate information
- 👤 Client details (hires, reviews, location)
- 📄 Job description preview
- 🔗 Direct link to apply on Upwork

**Note:** Slack will only send notifications for **new jobs** that haven't been seen before, preventing duplicate notifications.

### AI Job Qualification (Optional)

Automatically filter out low-quality jobs using OpenAI GPT-4o-mini before they reach Slack. This feature intelligently vets each job posting using a 3-tier qualification system.

#### How It Works

The AI analyzes each job based on:
- Job title and description
- Budget and rate information
- Client history (total hires, spend, reviews)
- Spend-per-hire ratio to identify low-value clients
- Relevance to your target client profile (Shopify CRO/Meta ads)

#### Three-Tier Qualification System

**TIER 1 - Ideal Match** (Always Accepted)
- Shopify brands doing $100k+/month or similar high revenue
- Meta/Facebook ads scaling challenges, CPA/CAC optimization
- CRO, conversion optimization, PDP redesign, A/B testing
- Budget: $50+/hr or $500+ fixed price
- **Example:** "Shopify CRO Expert - Scaling Meta Ads from $10k to $50k/day"

**TIER 2 - Upsell Potential** (Accepted)
- Quick fixes on Shopify stores (can lead to larger projects)
- Klaviyo email marketing (adjacent to CRO work)
- Smaller CRO projects ($30-50/hr or $200-500 fixed)
- Established brands needing help (even if smaller scope)
- **Example:** "Klaviyo Expert for Email Flow Setup - Shopify Store"

**TIER 3 - Hard Reject** (Filtered Out)
- Low-value clients with poor spend-to-hire ratios (e.g., 300+ hires but only $3k spent)
- Extremely low budgets ($5-20 fixed price)
- Wrong platforms (WordPress, Wix, etc.)
- Dropshipping without traction, brand new stores, generic VA work
- **Example:** "$5 Shopify banner design" from client with 332 hires and $3.3k total spent

#### Setup Instructions

1. **Get an OpenAI API key:**
   - Visit [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Create a new API key
   - Copy the key (starts with `sk-proj-...`)

2. **Add to your `.env` file:**
   ```env
   OPENAI_API_KEY=sk-proj-your-key-here
   ```

3. **Restart the scheduler:**
   ```bash
   npm start
   ```

#### Testing the Qualifier

Test the AI qualification with sample jobs:

```bash
npm run test-openai
```

This runs 7 sample jobs through the qualifier (2 Tier 1, 2 Tier 2, 3 Tier 3) and shows how they're classified.

#### Cost Information

- **Model:** GPT-4o-mini (cost-effective)
- **Per-job cost:** ~$0.001 (one-tenth of a cent)
- **Monthly estimate:**
  - 10 jobs/run × 4 runs/day = 40 jobs/day
  - Cost: $0.04/day = **~$1.20/month**
- **Worst case:** 50 jobs/run × 6 runs/day = **~$9/month**

Much cheaper than manually reviewing irrelevant jobs!

#### What Happens

**With OpenAI enabled:**
- New jobs are analyzed by AI before Slack notification
- Tier 1 & 2 jobs → Sent to Slack ✅
- Tier 3 jobs → Logged to console only (not sent to Slack) 🚫
- Console shows qualification stats and reasoning

**Without OpenAI (key not provided):**
- All jobs sent to Slack as before
- No filtering or additional costs
- Warning message shown in console

**If OpenAI fails (API error, timeout):**
- Job is allowed through (fail-open behavior)
- Warning logged to console
- Ensures you never miss important opportunities

## Usage

### Running the Scheduler

```bash
npm start
```

### Testing Job Search Manually

You can test the job search without the scheduler:

```bash
npm test
# or
node upwork-client.js
```

### Testing AI Qualification

Test the OpenAI job qualifier with sample jobs:

```bash
npm run test-openai
```

This will run 7 sample jobs through the AI (representing all 3 tiers) and show you how they're classified.

### Re-authenticating

If your refresh token expires (after 2 weeks of inactivity) or you need to re-authenticate:

```bash
npm run auth
```

### Stopping the Scheduler

Press `Ctrl+C` in the terminal to stop the scheduler gracefully.

## Output Format

The console will display:

```
================================================================================
📊 SEARCH RESULTS - Total: 25 jobs found
================================================================================

🔹 Job #1
   Title: Shopify Expert Needed for Store Customization
   ID: ~012345678901234567
   Posted: 2/9/2026, 10:30:00 AM
   URL: https://www.upwork.com/jobs/~012345678901234567
   Budget: $25 - $50/hr (Hourly)
   Skills: Shopify, HTML, CSS, JavaScript, Liquid
   Client: 15 hires, 42 reviews
   Description: Looking for an experienced Shopify developer to help customize...
   ----------------------------------------------------------------------------
...
```

## Project Structure

```
upwork-api/
├── auth.js                     # OAuth2 authentication script
├── upwork-client.js            # Upwork API client with GraphQL queries
├── scheduler.js                # Main scheduler with cron jobs
├── openai-qualifier.js         # AI job qualification module
├── slack-notifier.js           # Slack notification handler
├── job-tracker.js              # Tracks seen jobs to prevent duplicates
├── test-openai-qualifier.js    # Test script for AI qualification
├── test-slack.js               # Test script for Slack integration
├── package.json                # Project dependencies
├── .env                        # Environment variables (not in git)
├── .gitignore                  # Git ignore file
└── README.md                   # This file
```

## How It Works

### Authentication Flow

1. **Initial Authentication** (One-time)
   - User runs `npm run auth`
   - Local server starts on port 3000
   - Browser opens to Upwork authorization page
   - User clicks "Authorize"
   - Upwork redirects to `http://localhost:3000/callback?code=...`
   - Server captures authorization code
   - Code is exchanged for access token (24hr) + refresh token (2 weeks)
   - Tokens saved to `.env` file

2. **Automatic Token Refresh**
   - Before each API call, the client checks token validity
   - If access token is expired (HTTP 401), it automatically refreshes
   - New tokens are saved back to `.env`
   - API call is retried with new token

### GraphQL Query

The application uses Upwork's `marketplaceJobPostings` GraphQL query to search for jobs:

```graphql
query MarketplaceJobSearch($query: String, $limit: Int) {
  marketplaceJobPostings(
    filter: { searchExpression: $query }
    pagination: { count: $limit }
  ) {
    totalCount
    edges {
      node {
        id
        title
        description
        createdDateTime
        # ... more fields
      }
    }
  }
}
```

## Troubleshooting

### Port 3000 Already in Use

If you see "Port 3000 is already in use" during authentication:
- Stop any other applications using port 3000
- Or modify `UPWORK_REDIRECT_URI` in `.env` to use a different port (e.g., `:3001`)
- Make sure to update the callback URL in Upwork settings to match

### Authentication Failed

If authentication fails:
1. Verify your API credentials in `.env` are correct
2. Ensure the callback URL in Upwork settings matches your `.env` exactly
3. Check that you clicked "Authorize" in the browser
4. Try running `npm run auth` again

### No Jobs Found

If no jobs are returned:
- The search keyword might be too specific
- Try changing `SEARCH_KEYWORD` in `.env` to something broader
- Verify your API key has proper scopes/permissions in Upwork settings

### Token Expired Errors

If you see token-related errors:
- Run `npm run auth` to re-authenticate
- The refresh token expires after 2 weeks of inactivity

## API Rate Limits

Upwork API allows:
- **300 requests per minute** per IP address
- **40,000 requests per day** total

The default schedule (every 6 hours) keeps you well within limits.

## Security Notes

- ⚠️ **Never commit your `.env` file** - it contains sensitive credentials
- The `.gitignore` file is already configured to exclude `.env`
- Keep your access tokens private
- Tokens are stored locally in `.env` (not transmitted anywhere else)

## Future Enhancements

After the MVP is working, consider adding:
- Database storage (MongoDB, PostgreSQL)
- Email/Slack notifications for new jobs
- Duplicate detection (track previously seen jobs)
- Advanced filtering options
- REST API endpoints to access stored jobs
- Web dashboard for viewing results
- Multiple keyword support
- Export to CSV/JSON files

## Support

For Upwork API issues:
- [Upwork API Documentation](https://www.upwork.com/developer/documentation/graphql/api/docs/index.html)
- [Stack Overflow - upwork-api tag](https://stackoverflow.com/questions/tagged/upwork-api)
- [Upwork Help Center](https://support.upwork.com/)

## License

MIT
