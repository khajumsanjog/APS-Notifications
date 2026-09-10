# AWS EC2 & Ubuntu VPS Deployment Guide — APS

Production deployment guide for running APS (Aadhan Pradhan Services) on an **AWS EC2 instance or any Ubuntu 22.04/24.04 LTS VPS** (DigitalOcean, Hetzner, Linode, Vultr).

---

## 📑 Table of Contents
1. [Recommended Architecture & Hardware Sizing](#1-recommended-architecture--hardware-sizing)
2. [Step 1: Provisioning the EC2 Instance](#step-1-provisioning-the-ec2-instance)
3. [Step 2: Firewall & AWS Security Groups](#step-2-firewall--aws-security-groups)
4. [Step 3: Server Setup & Dependencies](#step-3-server-setup--dependencies)
5. [Step 4: Compiling & Installing APS](#step-4-compiling--installing-aps)
6. [Step 5: Configuring Systemd Service Daemon](#step-5-configuring-systemd-service-daemon)
7. [Step 6: Automatic SSL/TLS with Caddy Reverse Proxy](#step-6-automatic-ssltls-with-caddy-reverse-proxy)
8. [Step 7: Deploying the Developer Console Dashboard](#step-7-deploying-the-developer-console-dashboard)
9. [Step 8: Verification & Health Checks](#step-8-verification--health-checks)
10. [Maintenance & Zero-Downtime Updates](#10-maintenance--zero-downtime-updates)

---

## 1. Recommended Architecture & Hardware Sizing

Because APS is written in Go and uses an ultra-efficient event loop with goroutines, resource consumption is remarkably low compared to Node.js or Python alternatives:

| Workload | Concurrent Connections | Recommended EC2 Instance | RAM | Monthly Cost (AWS) |
| :--- | :--- | :--- | :--- | :--- |
| **Development & Testing** | 1 – 1,000 | `t4g.nano` or `t3.micro` | 0.5 GB – 1 GB | Free Tier / ~$3.50 |
| **Small to Mid Production** | 1,000 – 25,000 | `t4g.micro` or `t4g.small` | 1 GB – 2 GB | ~$4.20 – $8.40 |
| **High Scale Production** | 25,000 – 100,000+ | `t4g.medium` (2 vCPU, 4GB) + Redis | 4 GB | ~$16.80 |

---

## 2. Step 1: Provisioning the EC2 Instance

1. In the AWS Console, navigate to **EC2** → **Launch Instance**.
2. **Name**: `aps-production-server`.
3. **AMI**: Ubuntu Server 24.04 LTS (64-bit Arm or x86).
4. **Instance Type**: `t4g.micro` (Graviton ARM, fastest & cheapest) or `t3.micro`.
5. **Key Pair**: Select or create an SSH key pair (`.pem`).
6. **Storage**: 20 GB gp3 SSD.

---

## 3. Step 2: Firewall & AWS Security Groups

Under **Network Settings**, configure the following inbound rules:

| Type | Protocol | Port Range | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | `22` | Your IP or `0.0.0.0/0` | Administrative SSH access |
| **HTTP** | TCP | `80` | `0.0.0.0/0` | Caddy ACME SSL challenges |
| **HTTPS** | TCP | `443` | `0.0.0.0/0` | Secure WebSockets (`wss://`) & HTTPS API |
| **Custom TCP (Optional)** | TCP | `3000` | Your IP or `0.0.0.0/0` | Developer Console (if exposed directly) |

> 🔒 **Security Notice**: Never expose ports `8080`, `5432` (Postgres), or `6379` (Redis) directly to the public internet. Let Caddy reverse-proxy port `443` internally to port `8080`.

---

## 4. Step 3: Server Setup & Dependencies

Connect to your instance via SSH:
```bash
ssh -i your-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
```

Update system packages and install prerequisites:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw build-essential
```

Install Go (1.23+ or latest):
```bash
# Install latest Go binary
curl -OL https://go.dev/dl/go1.22.4.linux-arm64.tar.gz # Use linux-amd64 if using t3.micro
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.22.4.linux-arm64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.profile
source ~/.profile
go version
```

---

## 5. Step 4: Compiling & Installing APS

Clone the APS repository and build the production binary:

```bash
cd /opt
sudo git clone https://github.com/khajumsanjog/AdhanPradhanServices.git aps
sudo chown -R ubuntu:ubuntu /opt/aps
cd /opt/aps

# Build all-in-one daemon
go build -ldflags="-s -w" -o aps ./cmd/aps

# Build CLI utility
go build -ldflags="-s -w" -o apsctl ./cmd/apsctl
```

---

## 6. Step 5: Configuring Systemd Service Daemon

Create a systemd service to keep APS running continuously in the background, restart on crash, and start automatically on system boot:

```bash
sudo nano /etc/systemd/system/aps.service
```

Paste the following configuration:

```ini
[Unit]
Description=APS (Aadhan Pradhan Services) All-in-One Realtime Engine
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/aps
ExecStart=/opt/aps/aps all-in-one
Restart=always
RestartSec=5s
LimitNOFILE=65536
Environment="PORT=8080"
Environment="GIN_MODE=release"

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
# Reload systemd daemon
sudo systemctl daemon-reload

# Enable service to run on boot
sudo systemctl enable aps

# Start service
sudo systemctl start aps

# Check service status
sudo systemctl status aps
```

View live logs at any time:
```bash
journalctl -u aps -f
```

---

## 7. Step 6: Automatic SSL/TLS with Caddy Reverse Proxy

Caddy is the ideal reverse proxy for APS because it natively supports WebSockets without complex timeouts and automatically provisions and renews **Let's Encrypt SSL certificates**.

### Install Caddy:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### Configure Caddyfile:
```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the content with:
```caddy
aps.yourdomain.com {
    # Real-time WebSockets & REST API
    reverse_proxy localhost:8080 {
        # Preserve client IP addresses
        header_up X-Forwarded-For {remote_host}
        header_up X-Real-IP {remote_host}
    }
}

dashboard.yourdomain.com {
    # Developer Console Management Dashboard
    reverse_proxy localhost:3000
}
```

Reload Caddy:
```bash
sudo systemctl reload caddy
```

Point your DNS A-records (`aps.yourdomain.com` and `dashboard.yourdomain.com`) to your EC2 public IP. Caddy will issue certificates in under 10 seconds!

---

## 8. Step 7: Deploying the Developer Console Dashboard

Install Node.js 20 LTS:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Build and run the dashboard:
```bash
cd /opt/aps/dashboard
npm install
npm run build
```

Create a systemd service for the dashboard:
```bash
sudo nano /etc/systemd/system/aps-dashboard.service
```

Paste:
```ini
[Unit]
Description=APS Developer Console Dashboard
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/aps/dashboard
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5s
Environment="PORT=3000"
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable aps-dashboard
sudo systemctl start aps-dashboard
```

---

## 9. Step 8: Verification & Health Checks

Test WebSocket and API connectivity:

```bash
# Health check via Caddy
curl https://aps.yourdomain.com/healthz

# CLI status check
cd /opt/aps
./apsctl status
```

---

## 10. Maintenance & Zero-Downtime Updates

To update APS when a new version is released:

```bash
cd /opt/aps
git pull origin main
go build -ldflags="-s -w" -o aps ./cmd/aps
sudo systemctl restart aps
```

Because Go binaries boot in under 50 milliseconds, restart downtime is imperceptible to users.
