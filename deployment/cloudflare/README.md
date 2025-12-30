# Cloudflare Tunnel Configuration

This directory contains the Cloudflare Tunnel configuration for HomeOS.

## Files

- **`config.yml`** - Tunnel configuration file
  - Defines ingress rules for routing traffic
  - Specifies which services are exposed
  - Contains tunnel credentials path

## Setup

**Automated setup (recommended):**
```bash
./deployment/setup-cloudflare-tunnel.sh
```

**Manual setup:**
1. Install cloudflared
2. Authenticate with Cloudflare
3. Create a tunnel
4. Update `config.yml` with your tunnel ID and credentials path
5. Set up systemd service
6. Start the tunnel

See the complete guide: [CLOUDFLARE_TUNNELS.md](../CLOUDFLARE_TUNNELS.md)

## Configuration

After running the setup script, `config.yml` will contain:

- Your tunnel ID
- Path to credentials file (`~/.cloudflared/TUNNEL_ID.json`)
- Ingress rules for HomeOS services
- Connection settings

**Default ingress rules:**
- `homeos.yourdomain.com` → Next.js frontend (port 3000)
- PocketBase admin (port 8090) is NOT exposed (for security)

## Security Notes

⚠️ **PocketBase admin should remain internal-only**

Access PocketBase admin via:
- SSH tunnel
- Tailscale
- Local network only

If you must expose it, use Cloudflare Access for authentication.

## Support

For detailed documentation, troubleshooting, and advanced configuration:
- [Cloudflare Tunnels Guide](../CLOUDFLARE_TUNNELS.md)
- [Cloudflare Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
