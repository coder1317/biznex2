#!/bin/bash

# Biznex2 Installation Script for Raspberry Pi
# This script installs Biznex2 as a PM2 managed service

set -e

echo "================================================"
echo "  Biznex2 - Multi-Store POS System"
echo "  Raspberry Pi Installation"
echo "================================================"

# Check if running on Raspberry Pi
if ! uname -m | grep -q "arm"; then
    echo "⚠️  This script is designed for ARM architecture (Raspberry Pi)"
    echo "Continuing anyway..."
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root (use sudo)"
    exit 1
fi

INSTALL_DIR="/opt/biznex2"
SERVICE_USER="pi"

echo "📦 Installing Biznex2 to $INSTALL_DIR..."

# Update system
echo "🔄 Updating system..."
apt-get update
apt-get upgrade -y

# Install Node.js if not present
echo "🔍 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "📥 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Install PM2 globally if not present
echo "🔍 Checking PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "📥 Installing PM2..."
    npm install -g pm2
    pm2 startup systemd -u $SERVICE_USER --hp /home/$SERVICE_USER
else
    echo "✅ PM2 already installed"
fi

# Create installation directory
mkdir -p $INSTALL_DIR

# Copy app files
echo "📁 Copying application files..."
cp -r . $INSTALL_DIR/

cd $INSTALL_DIR

# Install dependencies
echo "⚙️  Installing npm dependencies (this may take a few minutes)..."
npm install --production

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
NODE_ENV=production
PORT=3000
DB_PATH=/home/$SERVICE_USER/.biznex2/biznex2.db
LOG_DIR=/home/$SERVICE_USER/.biznex2/logs
API_BASE_URL=http://localhost:3000
JWT_SECRET=
JWT_REFRESH_SECRET=
EOF
fi

# Create data directory
mkdir -p /home/$SERVICE_USER/.biznex2/{logs,backups}
chown -R $SERVICE_USER:$SERVICE_USER /home/$SERVICE_USER/.biznex2

# Create PM2 config
echo "🔧 Creating PM2 configuration..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'biznex2',
    script: './server/server-rpi.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './.pm2/logs/biznex2-error.log',
    out_file: './.pm2/logs/biznex2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# Change ownership
chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR

# Start with PM2
echo "🚀 Starting Biznex2 with PM2..."
su - $SERVICE_USER -c "cd $INSTALL_DIR && pm2 start ecosystem.config.js"
su - $SERVICE_USER -c "cd $INSTALL_DIR && pm2 save"
su - $SERVICE_USER -c "cd $INSTALL_DIR && pm2 startup"

echo ""
echo "================================================"
echo "  ✅ Installation Complete!"
echo "================================================"
echo ""
echo "📍 Biznex2 is running at:"
echo "   http://localhost:3000"
echo "   http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "🔧 Useful PM2 Commands:"
echo "   pm2 status          - Check status"
echo "   pm2 logs biznex2    - View logs"
echo "   pm2 restart biznex2 - Restart the app"
echo "   pm2 stop biznex2    - Stop the app"
echo ""
echo "📝 Configuration:"
echo "   Location: $INSTALL_DIR/.env"
echo "   Data Dir: /home/$SERVICE_USER/.biznex2"
echo ""
echo "🌐 Access the app:"
echo "   - From this machine: http://localhost:3000"
echo "   - From another machine: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
