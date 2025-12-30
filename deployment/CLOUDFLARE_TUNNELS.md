# Cloudflare Tunnels Setup for HomeOS

This guide shows you how to expose your HomeOS installation to the internet securely using Cloudflare Tunnels (formerly Argo Tunnels).

## Why Cloudflare Tunnels?

Cloudflare Tunnels provide several advantages over traditional port forwarding:

- ✅ **No port forwarding required** - Works behind NAT, firewalls, and CGNAT
- ✅ **Built-in DDoS protection** - Cloudflare's global network protects your server
- ✅ **Free SSL/TLS** - Automatic HTTPS with Cloudflare's certificates
- ✅ **Zero trust security** - Optionally require authentication via Cloudflare Access
- ✅ **No exposed IP address** - Your home IP remains hidden
- ✅ **Better than Tailscale** - Public access without requiring VPN client

## Prerequisites

Before starting, you need:

1. **A Cloudflare account** (free tier works fine)
   - Sign up at https://dash.cloudflare.com/sign-up

2. **A domain managed by Cloudflare**
   - Transfer your domain to Cloudflare's nameservers
   - Or register a new domain through Cloudflare

3. **HomeOS running** on your server
   - PocketBase on port 8090
   - Next.js frontend on port 3000

## Quick Setup

Run the automated setup script:

```bash
cd /path/to/homeOS
./deployment/setup-cloudflare-tunnel.sh
```

The script will:
1. Install cloudflared
2. Authenticate with Cloudflare
3. Create a tunnel
4. Configure DNS records
5. Set up systemd service
6. Start the tunnel

**Follow the prompts** and you'll have HomeOS accessible via HTTPS in minutes!

## Manual Setup

If you prefer to set things up manually:

### 1. Install cloudflared

**Ubuntu/Debian:**
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb
```

**RedHat/CentOS/Fedora:**
```bash
curl -L --output cloudflared.rpm https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-x86_64.rpm
sudo rpm -i cloudflared.rpm
rm cloudflared.rpm
```

**Other Linux:**
```bash
sudo curl -L --output /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo chmod +x /usr/local/bin/cloudflared
```

Verify installation:
```bash
cloudflared version
```

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser window. Select the domain you want to use for HomeOS.

A certificate will be saved to `~/.cloudflared/cert.pem`.

### 3. Create a Tunnel

```bash
cloudflared tunnel create homeos
```

This creates:
- A tunnel with ID (save this!)
- Credentials file at `~/.cloudflared/TUNNEL_ID.json`

List your tunnels:
```bash
cloudflared tunnel list
```

### 4. Configure the Tunnel

Edit `deployment/cloudflare/config.yml`:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/YOUR_USER/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Frontend - Next.js application
  - hostname: homeos.yourdomain.com
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true
      httpHostHeader: localhost:3000

  # Catch-all rule (required)
  - service: http_status:404
```

Replace:
- `YOUR_TUNNEL_ID` with your actual tunnel ID
- `YOUR_USER` with your Linux username
- `homeos.yourdomain.com` with your desired hostname

### 5. Create DNS Record

```bash
cloudflared tunnel route dns homeos homeos.yourdomain.com
```

This creates a CNAME record pointing to your tunnel.

### 6. Set Up Systemd Service

Copy the service file:
```bash
sudo cp deployment/systemd/cloudflared.service /etc/systemd/system/cloudflared@.service
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared@$(whoami).service
sudo systemctl start cloudflared@$(whoami).service
```

Check status:
```bash
sudo systemctl status cloudflared@$(whoami).service
```

### 7. Test Your Setup

Visit `https://homeos.yourdomain.com` in your browser.

You should see the HomeOS login page with a valid SSL certificate!

## Configuration Details

### Tunnel Configuration Explained

```yaml
# Your tunnel ID from 'cloudflared tunnel create'
tunnel: YOUR_TUNNEL_ID

# Path to credentials file
credentials-file: /home/YOUR_USER/.cloudflared/YOUR_TUNNEL_ID.json

# Ingress rules - evaluated in order
ingress:
  # Rule 1: Route homeos.yourdomain.com to Next.js
  - hostname: homeos.yourdomain.com
    service: http://localhost:3000
    originRequest:
      # Don't verify TLS for localhost connection
      noTLSVerify: true
      # Preserve original hostname
      httpHostHeader: localhost:3000
      # Connection timeouts
      connectTimeout: 30s
      keepAliveTimeout: 90s

  # Catch-all rule (REQUIRED) - must be last
  - service: http_status:404

# Optional: Enable metrics endpoint
# metrics: 0.0.0.0:9090

# Log level: debug, info, warn, error
loglevel: info
```

### Multiple Hostnames

You can expose multiple services:

```yaml
ingress:
  # Main HomeOS app
  - hostname: homeos.yourdomain.com
    service: http://localhost:3000

  # PocketBase admin (⚠️ Security risk - see below)
  - hostname: pocketbase.yourdomain.com
    service: http://localhost:8090

  # Catch-all
  - service: http_status:404
```

### Environment Configuration

**Important:** Keep PocketBase on localhost in your `.env`:

```bash
# frontend/.env
NEXT_PUBLIC_POCKETBASE_URL=http://localhost:8090
```

The Next.js server will connect to PocketBase locally, and Cloudflare Tunnel will handle external access.

## Security Considerations

### 🔒 Do NOT Expose PocketBase Admin

By default, the tunnel configuration **only exposes the Next.js frontend** on port 3000.

**PocketBase admin (port 8090) should remain internal-only** for security:

- Admin UI has broad permissions
- Direct database access
- Migration tools
- User management

**Access PocketBase admin via:**
- SSH tunnel: `ssh -L 8090:localhost:8090 user@yourserver`
- Tailscale: `http://YOUR_TAILSCALE_IP:8090/_/`
- Local network only

### 🛡️ Recommended Security Measures

1. **Use Cloudflare Access (Zero Trust)**
   ```bash
   # Require authentication for your domain
   # Set up at: https://dash.cloudflare.com/[account]/access
   ```

2. **Enable email verification**
   - Configure in PocketBase settings
   - Prevents unauthorized signups

3. **Use strong passwords**
   - For PocketBase admin account
   - For all HomeOS users

4. **Enable WAF rules**
   - Cloudflare dashboard → Security → WAF
   - Enable "OWASP ModSecurity Core Rule Set"

5. **Rate limiting**
   - Cloudflare dashboard → Security → Rate Limiting
   - Protect login endpoints

6. **Monitor tunnel logs**
   ```bash
   sudo journalctl -u cloudflared@$(whoami).service -f
   ```

### Exposing PocketBase (Advanced)

If you absolutely must expose PocketBase externally:

1. **Use Cloudflare Access** to require authentication
2. **Use a separate subdomain** (e.g., `pocketbase-admin.yourdomain.com`)
3. **Enable all security features** in PocketBase settings
4. **Monitor access logs** regularly
5. **Consider IP allowlisting** in Cloudflare

Example secure PocketBase config:

```yaml
# Require Cloudflare Access authentication
- hostname: pocketbase-admin.yourdomain.com
  service: http://localhost:8090
  originRequest:
    noTLSVerify: true
```

Then set up Cloudflare Access:
- Dashboard → Access → Applications → Add an application
- Choose "Self-hosted"
- Set subdomain: `pocketbase-admin`
- Configure authentication (Google, email OTP, etc.)

## Management Commands

### Service Management

```bash
# Start the tunnel
sudo systemctl start cloudflared@$(whoami).service

# Stop the tunnel
sudo systemctl stop cloudflared@$(whoami).service

# Restart the tunnel
sudo systemctl restart cloudflared@$(whoami).service

# Enable auto-start on boot
sudo systemctl enable cloudflared@$(whoami).service

# Disable auto-start
sudo systemctl disable cloudflared@$(whoami).service

# Check status
sudo systemctl status cloudflared@$(whoami).service

# View logs
sudo journalctl -u cloudflared@$(whoami).service -f

# View recent logs
sudo journalctl -u cloudflared@$(whoami).service -n 100
```

### Tunnel Management

```bash
# List all tunnels
cloudflared tunnel list

# Show tunnel info
cloudflared tunnel info homeos

# Delete a tunnel (⚠️ destructive)
cloudflared tunnel delete homeos

# Update DNS routing
cloudflared tunnel route dns homeos new-subdomain.yourdomain.com

# Show tunnel routes
cloudflared tunnel route list
```

### Testing and Debugging

```bash
# Test tunnel configuration
cloudflared tunnel ingress validate

# Show which service handles a URL
cloudflared tunnel ingress rule https://homeos.yourdomain.com

# Run tunnel in foreground (for debugging)
cloudflared tunnel --config deployment/cloudflare/config.yml run

# Enable debug logging
# Edit config.yml and set: loglevel: debug
# Then restart: sudo systemctl restart cloudflared@$(whoami).service
```

## Troubleshooting

### Tunnel won't start

**Check service status:**
```bash
sudo systemctl status cloudflared@$(whoami).service
sudo journalctl -u cloudflared@$(whoami).service -n 50
```

**Common issues:**
- Wrong tunnel ID in config.yml
- Credentials file path incorrect
- Config file syntax error
- HomeOS services not running

**Validate configuration:**
```bash
cloudflared tunnel ingress validate
```

### 502 Bad Gateway

**Causes:**
- Next.js frontend not running
- Wrong port in config
- Connection timeout

**Check services:**
```bash
sudo systemctl status homeos-frontend
sudo systemctl status pocketbase
```

**Test locally:**
```bash
curl http://localhost:3000
```

### DNS not resolving

**Check DNS record:**
```bash
# Should show CNAME to .cfargotunnel.com
dig homeos.yourdomain.com

# Or use:
nslookup homeos.yourdomain.com
```

**Recreate DNS record:**
```bash
cloudflared tunnel route dns homeos homeos.yourdomain.com
```

### Certificate errors

**Check Cloudflare SSL/TLS mode:**
- Dashboard → SSL/TLS → Overview
- Should be "Full" or "Full (strict)"
- NOT "Flexible"

**Cloudflare SSL modes:**
- **Flexible**: Cloudflare↔Client HTTPS, Cloudflare↔Origin HTTP (works but less secure)
- **Full**: Cloudflare↔Client HTTPS, Cloudflare↔Origin HTTPS (self-signed OK)
- **Full (strict)**: Requires valid certificate on origin (not needed for tunnels)

For Cloudflare Tunnels, use **Full** mode.

### Tunnel keeps disconnecting

**Check system resources:**
```bash
# CPU and memory
top

# Network connectivity
ping cloudflare.com
```

**Check tunnel logs:**
```bash
sudo journalctl -u cloudflared@$(whoami).service -f
```

**Increase connection limits:**

Edit `deployment/cloudflare/config.yml`:
```yaml
originRequest:
  keepAliveConnections: 100
  keepAliveTimeout: 90s
  tcpKeepAlive: 30s
```

### Performance issues

**Enable HTTP/2:**
Cloudflare Tunnels use HTTP/2 by default. Ensure Next.js supports it.

**Monitor metrics:**

Enable metrics in `config.yml`:
```yaml
metrics: 0.0.0.0:9090
```

Then visit: `http://localhost:9090/metrics`

**Check Cloudflare Analytics:**
- Dashboard → Analytics → Traffic

**Optimize Next.js:**
```bash
# Check build size
npm run build

# Analyze bundle
cd frontend
npm install -D @next/bundle-analyzer
```

## Advanced Configuration

### Load Balancing

Run multiple tunnel instances for high availability:

```bash
# Start tunnel on multiple servers
# Cloudflare automatically load balances
```

### Tunnel over QUIC

Use QUIC protocol for better performance:

```yaml
# config.yml
protocol: quic
```

### Access Logs

Enable detailed access logging:

```yaml
# config.yml
loglevel: debug
```

Then view:
```bash
sudo journalctl -u cloudflared@$(whoami).service -f | grep access
```

### IP Allowlisting

Use Cloudflare Firewall Rules:
- Dashboard → Security → Firewall Rules
- Create rule: "Allow only from specific IPs"

### Cloudflare Access Integration

Require authentication for all requests:

1. **Set up Access application:**
   - Dashboard → Access → Applications → Add
   - Application type: Self-hosted
   - Subdomain: homeos
   - Domain: yourdomain.com

2. **Configure authentication:**
   - Choose providers (Google, GitHub, email OTP, etc.)
   - Set session duration

3. **Create access policies:**
   - Allow: Email ends with @yourdomain.com
   - Or: Require specific email addresses

4. **No config.yml changes needed** - Cloudflare handles it

### Custom Headers

Add custom headers to requests:

```yaml
originRequest:
  httpHostHeader: homeos.yourdomain.com
  # Add custom headers
  http2Origin: true
  # Set timeout
  noHappyEyeballs: false
```

## Comparison: Cloudflare Tunnels vs Tailscale

| Feature | Cloudflare Tunnels | Tailscale |
|---------|-------------------|-----------|
| **Public Access** | ✅ Yes | ❌ No (VPN required) |
| **Setup Complexity** | Medium | Easy |
| **Client Required** | ❌ No | ✅ Yes (Tailscale app) |
| **DDoS Protection** | ✅ Yes | ❌ No |
| **SSL Certificate** | ✅ Automatic | ⚠️ Self-signed |
| **Access Control** | ✅ Cloudflare Access | ✅ Tailscale ACLs |
| **Free Tier** | ✅ Unlimited | ✅ Up to 100 devices |
| **Speed** | Fast (Cloudflare CDN) | Very fast (direct P2P) |
| **Privacy** | ⚠️ Proxied through CF | ✅ Direct connection |

**When to use Cloudflare Tunnels:**
- You want public web access
- You need DDoS protection
- You don't want to install VPN clients
- You want to share with non-technical users

**When to use Tailscale:**
- You want private access only
- Maximum performance (P2P)
- Don't want traffic through third party
- Already using Tailscale for other services

**Pro tip:** Use both!
- Cloudflare Tunnels for public access
- Tailscale for admin access (PocketBase, SSH, etc.)

## Cost

Cloudflare Tunnels are **completely free** with no bandwidth limits!

**Paid features (optional):**
- Cloudflare Access: $3/user/month (5 users free)
- Load Balancing: $5/month + $0.50/500k requests
- Advanced DDoS protection: Enterprise only

For personal HomeOS use, the free tier is perfect.

## Migration from Tailscale

If you're currently using Tailscale:

1. **Keep Tailscale for admin access**
   - PocketBase admin UI
   - SSH access
   - Private file shares

2. **Add Cloudflare Tunnel for public access**
   - HomeOS web interface only
   - No VPN client needed for family/friends

3. **Update DNS**
   - Keep Tailscale IPs for internal use
   - Use Cloudflare domain for external

## Backup and Disaster Recovery

### Backup Tunnel Configuration

```bash
# Backup credentials
cp ~/.cloudflared/*.json ~/backups/

# Backup config
cp deployment/cloudflare/config.yml ~/backups/

# Backup cert
cp ~/.cloudflared/cert.pem ~/backups/
```

### Restore Tunnel

```bash
# Restore credentials
mkdir -p ~/.cloudflared
cp ~/backups/*.json ~/.cloudflared/
cp ~/backups/cert.pem ~/.cloudflared/

# Restore config
cp ~/backups/config.yml deployment/cloudflare/

# Restart service
sudo systemctl restart cloudflared@$(whoami).service
```

### Create New Tunnel (if old one is lost)

```bash
# Login again
cloudflared tunnel login

# Create new tunnel
cloudflared tunnel create homeos-new

# Update config.yml with new tunnel ID

# Update DNS
cloudflared tunnel route dns homeos-new homeos.yourdomain.com

# Restart service
sudo systemctl restart cloudflared@$(whoami).service
```

## Support and Resources

- **Cloudflare Docs**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **Cloudflare Community**: https://community.cloudflare.com/
- **HomeOS Issues**: https://github.com/yourusername/homeOS/issues
- **Cloudflare Status**: https://www.cloudflarestatus.com/

## Summary

Cloudflare Tunnels provide a secure, free, and powerful way to expose your HomeOS installation to the internet without port forwarding.

**Key benefits:**
- ✅ Zero trust security
- ✅ Built-in DDoS protection
- ✅ Free SSL certificates
- ✅ No exposed home IP
- ✅ Works behind NAT/CGNAT
- ✅ Professional infrastructure

**Quick start:**
```bash
./deployment/setup-cloudflare-tunnel.sh
```

**Access your HomeOS:**
```
https://homeos.yourdomain.com
```

Enjoy your securely accessible home management system!
