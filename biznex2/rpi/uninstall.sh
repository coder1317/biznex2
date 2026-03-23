#!/bin/bash

# Biznex2 Uninstall Script for Raspberry Pi

set -e

echo "⚠️  WARNING: This will uninstall Biznex2"
echo ""
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Installation aborted"
    exit 1
fi

SERVICE_USER="pi"
INSTALL_DIR="/opt/biznex2"

echo "🛑 Stopping Biznex2..."
su - $SERVICE_USER -c "pm2 stop biznex2" || true
su - $SERVICE_USER -c "pm2 delete biznex2" || true

echo "🗑️  Removing installation directory..."
rm -rf $INSTALL_DIR

echo "✅ Uninstallation complete"
echo ""
echo "💾 Your data has been preserved at:"
echo "   /home/$SERVICE_USER/.biznex2"
echo ""
