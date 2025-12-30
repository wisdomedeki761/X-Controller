#!/bin/bash

# X-Raider Linux VPS Deployment Script
echo "🚀 Starting X-Raider deployment on Linux VPS..."

# Check if running as root (not recommended)
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root for security reasons."
   echo "   Create a non-root user and run as that user."
   exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found! Please create it with your configuration."
    echo "   See README.md for required environment variables."
    exit 1
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  PM2 not found. Installing globally..."
    npm install -g pm2
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p data
mkdir -p temp
mkdir -p accounts

# Set proper permissions
echo "🔒 Setting file permissions..."
chmod 600 .env
chmod 755 deploy.sh
chmod 644 ecosystem.config.js

# Test configuration
echo "🔧 Testing configuration..."
node -e "
const dotenv = require('dotenv');
dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
    process.exit(1);
}

if (!process.env.ADMIN_IDS) {
    console.error('❌ ADMIN_IDS not found in .env');
    process.exit(1);
}

console.log('✅ Configuration looks good!');
"

if [ $? -ne 0 ]; then
    echo "❌ Configuration test failed. Please check your .env file."
    exit 1
fi

# Optional: Set up PM2 startup script (run as root if needed)
echo "⚙️  Setting up PM2 auto-startup..."
sudo pm2 startup systemd -u $USER --hp $HOME

echo "🤖 Starting X-Raider with PM2..."
npm run pm2:start

# Wait a moment for processes to start
sleep 5

# Check status
echo "📊 Checking deployment status..."
npm run pm2:status

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

echo ""
echo "✅ Deployment complete on Linux VPS!"
echo ""
echo "📋 Useful commands:"
echo "  pm2 status              # Check status"
echo "  pm2 logs                # View all logs"
echo "  pm2 logs x-raider-telegram --lines 20    # View bot logs"
echo "  pm2 restart all         # Restart all services"
echo "  pm2 stop all           # Stop all services"
echo "  pm2 delete all         # Remove all processes"
echo ""
echo "🔄 PM2 will automatically restart services on server reboot"
echo "📁 Log files are in ./logs/ directory"
echo ""
echo "🎯 Your X-Raider Telegram bot is now running in production!"
echo "   Send /start to your bot to begin."
