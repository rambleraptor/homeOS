#!/bin/bash
set -euo pipefail

# Homestead service setup.
# Installs the single systemd service that runs the `homestead` binary
# (aepbase in-process + Bun sidecar + embedded SPA).

if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run this script with sudo"
    exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CURRENT_USER="${SUDO_USER:-$USER}"

echo "🔧 Setting up the Homestead systemd service..."
echo "📍 Project directory: $PROJECT_DIR"
echo "👤 Running as user: $CURRENT_USER"

if [ ! -f "$PROJECT_DIR/packages/homestead-app/.env" ]; then
  echo "⚠️  packages/homestead-app/.env not found — the service loads it as its EnvironmentFile."
  echo "    Create it (see packages/homestead-app/.env.example) with your VAPID keys before"
  echo "    starting the service."
fi

echo "📝 Installing /etc/systemd/system/homeos.service"
sed -e "s|/path/to/homeOS|$PROJECT_DIR|g" \
    -e "s|User=homeosuser|User=$CURRENT_USER|g" \
    "$PROJECT_DIR/deployment/systemd/homeos.service" > /etc/systemd/system/homeos.service
chmod 644 /etc/systemd/system/homeos.service

echo "🔄 Reloading systemd..."
systemctl daemon-reload

echo "✅ Enabling service..."
systemctl enable homeos.service

echo ""
echo "✅ Service installed."
echo ""
echo "Service management:"
echo "  Start:    sudo systemctl start homeos"
echo "  Stop:     sudo systemctl stop homeos"
echo "  Restart:  sudo systemctl restart homeos"
echo "  Status:   sudo systemctl status homeos"
echo "  Logs:     sudo journalctl -u homeos -f"
echo ""
echo "Next: sudo systemctl start homeos  →  http://localhost:3000"
