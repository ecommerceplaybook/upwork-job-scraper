# DigitalOcean Deployment Guide

This guide will help you deploy the Upwork Job Scraper to a DigitalOcean droplet.

## Prerequisites

- DigitalOcean account
- SSH key added to DigitalOcean
- GitHub repository created: https://github.com/ecommerceplaybook/upwork-job-scraper
- Your `.env` credentials from local machine

## Step 1: Create Droplet

1. Go to: https://cloud.digitalocean.com/droplets/new
2. **Image**: Ubuntu 22.04 (LTS) x64
3. **Plan**: Basic - $6/month (1 GB RAM, 1 vCPU) is sufficient
4. **Datacenter**: Choose closest to you
5. **Authentication**: Select your SSH key (`upwork-scraper-digitalocean`)
6. **Hostname**: `upwork-scraper`
7. Click **"Create Droplet"**

Wait 1-2 minutes for the droplet to be created.

## Step 2: Get Your Droplet IP Address

From the DigitalOcean dashboard, copy your droplet's IP address.

Example: `104.131.166.84`

## Step 3: SSH Into Your Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

Say "yes" when prompted to add the host to known hosts.

## Step 4: Run Deployment Script

Once logged into your droplet, run these commands:

```bash
# Download the deployment script
curl -o deploy.sh https://raw.githubusercontent.com/ecommerceplaybook/upwork-job-scraper/main/deploy-to-digitalocean.sh

# Make it executable
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```

The script will:
- Install Node.js 20.x
- Install PM2 (process manager)
- Clone your GitHub repository
- Install npm dependencies
- Create a template `.env` file
- Prompt you to add your credentials

## Step 5: Configure Environment Variables

When prompted, edit the `.env` file:

```bash
nano ~/upwork-job-scraper/.env
```

**Copy these values from your local `.env` file:**

```env
UPWORK_API_KEY=207aba41dd0f32cf55f35834e5177161
UPWORK_API_SECRET=7356900e97345cca
UPWORK_REDIRECT_URI=http://localhost:3000/callback
UPWORK_ACCESS_TOKEN=oauth2v2_pub_275c486016caeba62c61b7239017b099
UPWORK_REFRESH_TOKEN=oauth2v2_pub_152eb1054a97e56e8200b34b181e832c
CRON_SCHEDULE=*/10 * * * *
SEARCH_KEYWORDS=Shopify,E-Commerce,Website Design,Conversion Rate Optimization,B2B Store,cannabis,cbd,thc,klaviyo,CRO,ecommerce,web design,web development,website redesign,AI automation,n8n,DTC,ecom
FILTER_COUNTRIES=United States,USA,Canada,CAN
```

**Save and exit:**
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter`

Then continue with the deployment script (press Enter).

## Step 6: Verify It's Running

Check the status:

```bash
pm2 status
```

View live logs:

```bash
pm2 logs upwork-scraper
```

You should see job searches happening every 10 minutes!

## Useful PM2 Commands

```bash
# View logs
pm2 logs upwork-scraper

# View real-time monitoring
pm2 monit

# Check status
pm2 status

# Restart the app
pm2 restart upwork-scraper

# Stop the app
pm2 stop upwork-scraper

# View detailed info
pm2 info upwork-scraper
```

## Updating Your Code

When you make changes locally and push to GitHub:

```bash
# On your local machine
git add .
git commit -m "Your changes"
git push

# On DigitalOcean droplet
ssh root@YOUR_DROPLET_IP
cd ~/upwork-job-scraper
git pull
pm2 restart upwork-scraper
```

## File Locations on Server

- **Application**: `~/upwork-job-scraper/`
- **Environment variables**: `~/upwork-job-scraper/.env`
- **Job tracking**: `~/upwork-job-scraper/seen-jobs.json`
- **PM2 logs**: `~/.pm2/logs/`

## Troubleshooting

### Check if scraper is running
```bash
pm2 status
```

### View recent errors
```bash
pm2 logs upwork-scraper --lines 50
```

### Restart after making changes
```bash
cd ~/upwork-job-scraper
git pull
pm2 restart upwork-scraper
```

### Check system resources
```bash
pm2 monit
```

### If the app crashes
```bash
pm2 logs upwork-scraper --err
```

## Important Notes

- ⚠️ **Never commit your `.env` file to GitHub** (it's already in `.gitignore`)
- 📝 The `seen-jobs.json` file will be created on the server and grow over time
- 🔄 PM2 will automatically restart the app if it crashes
- 🔁 PM2 will start the app automatically when the server reboots
- 📊 Jobs will be logged to PM2's log files (not visible in console)

## Stopping the Local Scraper

Since the server will be running, you can stop your local version:

```bash
# Find the process
ps aux | grep "node scheduler.js"

# Kill it
pkill -f "node scheduler.js"
```

## Cost Estimate

- **$6/month** for the Basic droplet
- **$0** for data transfer (well within limits)
- **Total: ~$6/month** for 24/7 job scraping

---

Your scraper will now run 24/7 on DigitalOcean, checking for new jobs every 10 minutes! 🚀
