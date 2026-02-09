#!/bin/bash

# Upwork Job Scraper - DigitalOcean Deployment Script
# Run this script on your DigitalOcean droplet after SSH'ing in

set -e  # Exit on any error

echo "🚀 Upwork Job Scraper - DigitalOcean Deployment"
echo "==============================================="
echo ""

# Update system
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 20.x (LTS)
echo "📦 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "   ✓ Node.js already installed"
fi

node --version
npm --version

# Install PM2 globally (process manager)
echo "📦 Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo "   ✓ PM2 already installed"
fi

# Clone repository
echo "📥 Cloning repository..."
cd ~
if [ -d "upwork-job-scraper" ]; then
    echo "   ⚠️  Directory already exists. Updating..."
    cd upwork-job-scraper
    git pull
else
    git clone https://github.com/ecommerceplaybook/upwork-job-scraper.git
    cd upwork-job-scraper
fi

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOL'
UPWORK_API_KEY=YOUR_API_KEY_HERE
UPWORK_API_SECRET=YOUR_API_SECRET_HERE
UPWORK_REDIRECT_URI=http://localhost:3000/callback
UPWORK_ACCESS_TOKEN=
UPWORK_REFRESH_TOKEN=
CRON_SCHEDULE=*/10 * * * *
SEARCH_KEYWORDS=Shopify,E-Commerce,Website Design,Conversion Rate Optimization,B2B Store,cannabis,cbd,thc,klaviyo,CRO,ecommerce,web design,web development,website redesign,AI automation,n8n,DTC,ecom
FILTER_COUNTRIES=United States,USA,Canada,CAN
EOL
    echo ""
    echo "⚠️  IMPORTANT: Edit the .env file with your actual credentials:"
    echo "   nano .env"
    echo ""
    echo "   You need to add:"
    echo "   - UPWORK_API_KEY"
    echo "   - UPWORK_API_SECRET"
    echo "   - UPWORK_ACCESS_TOKEN (from your local machine)"
    echo "   - UPWORK_REFRESH_TOKEN (from your local machine)"
    echo ""
    read -p "Press Enter after you've updated .env file..."
else
    echo "   ✓ .env file already exists"
fi

# Start with PM2
echo "🚀 Starting application with PM2..."
pm2 delete upwork-scraper 2>/dev/null || true
pm2 start scheduler.js --name upwork-scraper

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 to start on system boot
echo "🔄 Setting up PM2 startup script..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Useful commands:"
echo "   pm2 logs upwork-scraper      # View logs"
echo "   pm2 status                   # Check status"
echo "   pm2 restart upwork-scraper   # Restart app"
echo "   pm2 stop upwork-scraper      # Stop app"
echo "   pm2 monit                    # Monitor in real-time"
echo ""
echo "🌐 Your scraper is now running 24/7!"
echo "   It will check for jobs every 10 minutes."
echo ""
