#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   HomeOS - Cloudflare Tunnel Setup${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
   echo -e "${RED}✗ Please do not run this script as root${NC}"
   echo -e "  Run as your normal user - it will use sudo when needed"
   exit 1
fi

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

if ! command -v curl &> /dev/null; then
    echo -e "${RED}✗ curl is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}"
echo ""

# Step 2: Install cloudflared
echo -e "${BLUE}Step 2: Installing cloudflared...${NC}"

if command -v cloudflared &> /dev/null; then
    CURRENT_VERSION=$(cloudflared version | head -n1)
    echo -e "${YELLOW}! cloudflared is already installed: ${CURRENT_VERSION}${NC}"
    read -p "Do you want to reinstall/update? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Skipping installation${NC}"
    else
        INSTALL=true
    fi
else
    INSTALL=true
fi

if [ "$INSTALL" = true ]; then
    # Detect OS and install cloudflared
    if [ -f /etc/debian_version ]; then
        echo "Installing on Debian/Ubuntu..."
        curl -L --output /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i /tmp/cloudflared.deb
        rm /tmp/cloudflared.deb
    elif [ -f /etc/redhat-release ]; then
        echo "Installing on RedHat/CentOS/Fedora..."
        curl -L --output /tmp/cloudflared.rpm https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-x86_64.rpm
        sudo rpm -i /tmp/cloudflared.rpm
        rm /tmp/cloudflared.rpm
    else
        echo "Installing binary directly..."
        sudo curl -L --output /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
        sudo chmod +x /usr/local/bin/cloudflared
    fi

    echo -e "${GREEN}✓ cloudflared installed successfully${NC}"
    cloudflared version
fi
echo ""

# Step 3: Authenticate with Cloudflare
echo -e "${BLUE}Step 3: Cloudflare Authentication${NC}"
echo -e "${YELLOW}You need to authenticate with Cloudflare to create a tunnel.${NC}"
echo -e "${YELLOW}This will open a browser window for login.${NC}"
echo ""
read -p "Continue with authentication? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    cloudflared tunnel login
    echo -e "${GREEN}✓ Authentication successful${NC}"
else
    echo -e "${YELLOW}! Skipping authentication - you'll need to do this manually${NC}"
fi
echo ""

# Step 4: Create tunnel
echo -e "${BLUE}Step 4: Create Cloudflare Tunnel${NC}"
echo -e "${YELLOW}Enter a name for your tunnel (e.g., 'homeos-prod'):${NC}"
read -p "Tunnel name: " TUNNEL_NAME

if [ -z "$TUNNEL_NAME" ]; then
    echo -e "${RED}✗ Tunnel name cannot be empty${NC}"
    exit 1
fi

# Check if tunnel already exists
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo -e "${YELLOW}! Tunnel '$TUNNEL_NAME' already exists${NC}"
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
    echo -e "  Tunnel ID: ${TUNNEL_ID}"
else
    echo "Creating tunnel..."
    cloudflared tunnel create "$TUNNEL_NAME"
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
    echo -e "${GREEN}✓ Tunnel created successfully${NC}"
    echo -e "  Tunnel ID: ${TUNNEL_ID}"
fi
echo ""

# Step 5: Configure tunnel
echo -e "${BLUE}Step 5: Configure Tunnel${NC}"
echo -e "${YELLOW}Enter your domain name (e.g., 'example.com'):${NC}"
read -p "Domain: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}✗ Domain cannot be empty${NC}"
    exit 1
fi

echo -e "${YELLOW}Enter subdomain for HomeOS (e.g., 'homeos' for homeos.${DOMAIN}):${NC}"
read -p "Subdomain: " SUBDOMAIN
SUBDOMAIN=${SUBDOMAIN:-homeos}

HOSTNAME="${SUBDOMAIN}.${DOMAIN}"

# Update config file
CONFIG_FILE="$SCRIPT_DIR/cloudflare/config.yml"
CREDENTIALS_FILE="$HOME/.cloudflared/${TUNNEL_ID}.json"

echo "Updating configuration file..."
sed -i "s/tunnel: YOUR_TUNNEL_ID/tunnel: ${TUNNEL_ID}/" "$CONFIG_FILE"
sed -i "s|credentials-file: /home/YOUR_USER/.cloudflared/YOUR_TUNNEL_ID.json|credentials-file: ${CREDENTIALS_FILE}|" "$CONFIG_FILE"
sed -i "s/homeos.yourdomain.com/${HOSTNAME}/" "$CONFIG_FILE"

echo -e "${GREEN}✓ Configuration updated${NC}"
echo -e "  Config file: ${CONFIG_FILE}"
echo ""

# Step 6: Create DNS record
echo -e "${BLUE}Step 6: Create DNS Record${NC}"
echo "Creating DNS CNAME record for ${HOSTNAME}..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME"
echo -e "${GREEN}✓ DNS record created${NC}"
echo ""

# Step 7: Install systemd service
echo -e "${BLUE}Step 7: Install systemd service${NC}"

# Update systemd service with current user
SYSTEMD_SERVICE="$SCRIPT_DIR/systemd/cloudflared.service"
SERVICE_NAME="cloudflared@$(whoami).service"

echo "Installing systemd service..."
sudo cp "$SYSTEMD_SERVICE" "/etc/systemd/system/cloudflared@.service"
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

echo -e "${GREEN}✓ Systemd service installed${NC}"
echo ""

# Step 8: Update environment configuration
echo -e "${BLUE}Step 8: Update Environment Configuration${NC}"
echo -e "${YELLOW}Update frontend/.env with:${NC}"
echo -e "  NEXT_PUBLIC_POCKETBASE_URL=http://localhost:8090"
echo ""
echo -e "${YELLOW}Note: PocketBase should remain on localhost. The tunnel will${NC}"
echo -e "${YELLOW}proxy requests from your domain to the local services.${NC}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Step 9: Start the tunnel
echo -e "${BLUE}Step 9: Start Cloudflare Tunnel${NC}"
read -p "Start the tunnel now? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    sudo systemctl start "$SERVICE_NAME"
    sleep 2
    sudo systemctl status "$SERVICE_NAME" --no-pager
    echo -e "${GREEN}✓ Tunnel started${NC}"
else
    echo -e "${YELLOW}! Skipping tunnel start${NC}"
    echo -e "  Start manually with: sudo systemctl start $SERVICE_NAME"
fi
echo ""

# Summary
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Your HomeOS is now accessible at:${NC}"
echo -e "  ${GREEN}https://${HOSTNAME}${NC}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo -e "  Start tunnel:   ${YELLOW}sudo systemctl start $SERVICE_NAME${NC}"
echo -e "  Stop tunnel:    ${YELLOW}sudo systemctl stop $SERVICE_NAME${NC}"
echo -e "  Restart tunnel: ${YELLOW}sudo systemctl restart $SERVICE_NAME${NC}"
echo -e "  View logs:      ${YELLOW}sudo journalctl -u $SERVICE_NAME -f${NC}"
echo -e "  Check status:   ${YELLOW}sudo systemctl status $SERVICE_NAME${NC}"
echo ""
echo -e "${BLUE}Configuration files:${NC}"
echo -e "  Config:      ${CONFIG_FILE}"
echo -e "  Credentials: ${CREDENTIALS_FILE}"
echo -e "  Service:     /etc/systemd/system/cloudflared@.service"
echo ""
echo -e "${YELLOW}Important Security Notes:${NC}"
echo -e "  1. PocketBase admin is NOT exposed by default (recommended)"
echo -e "  2. If you need external PocketBase access, uncomment the section"
echo -e "     in ${CONFIG_FILE} and add proper authentication"
echo -e "  3. Always use strong passwords for your HomeOS users"
echo -e "  4. Consider enabling Cloudflare Access for additional security"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Visit https://${HOSTNAME} in your browser"
echo -e "  2. Log in with your HomeOS credentials"
echo -e "  3. Configure Cloudflare Access rules (optional but recommended)"
echo -e "  4. Enable email verification in PocketBase settings"
echo ""
echo -e "${GREEN}Enjoy your securely accessible HomeOS!${NC}"
