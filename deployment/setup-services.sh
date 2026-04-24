#!/bin/bash
set -e

# Homestead Service Setup Script
# Sets up systemd services for aepbase and the frontend.

if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run this script with sudo"
    exit 1
fi

echo "🔧 Setting up Homestead systemd services..."

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CURRENT_USER="${SUDO_USER:-$USER}"

echo "📍 Project directory: $PROJECT_DIR"
echo "👤 Running as user: $CURRENT_USER"

echo "📝 Configuring service files..."

sed -e "s|/path/to/homestead|$PROJECT_DIR|g" \
    -e "s|User=homesteaduser|User=$CURRENT_USER|g" \
    "$PROJECT_DIR/deployment/systemd/aepbase.service" > /etc/systemd/system/homestead-aepbase.service

sed -e "s|/path/to/homestead|$PROJECT_DIR|g" \
    -e "s|User=homesteaduser|User=$CURRENT_USER|g" \
    "$PROJECT_DIR/deployment/systemd/homestead-frontend.service" > /etc/systemd/system/homestead-frontend.service

chmod 644 /etc/systemd/system/homestead-aepbase.service
chmod 644 /etc/systemd/system/homestead-frontend.service

echo "🔄 Reloading systemd..."
systemctl daemon-reload

echo "✅ Enabling services..."
systemctl enable homestead-aepbase.service
systemctl enable homestead-frontend.service

echo ""
echo "✅ Services installed successfully!"
echo ""
echo "Service management commands:"
echo "  Start services:   sudo systemctl start homestead-aepbase homestead-frontend"
echo "  Stop services:    sudo systemctl stop homestead-aepbase homestead-frontend"
echo "  Restart services: sudo systemctl restart homestead-aepbase homestead-frontend"
echo "  View status:      sudo systemctl status homestead-aepbase homestead-frontend"
echo "  View logs:        sudo journalctl -u homestead-aepbase -f"
echo "                    sudo journalctl -u homestead-frontend -f"
echo ""
echo "Next steps:"
echo "  1. Start services: sudo systemctl start homestead-aepbase homestead-frontend"
echo "  2. aepbase REST:   http://localhost:8090"
echo "  3. Homestead:      http://localhost:3000"
