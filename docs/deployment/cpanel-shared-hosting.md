# cPanel Shared Hosting & APS — Deployment Guide

This guide answers the question: **"Can I run APS on my shared cPanel hosting account, and how do I use APS with a cPanel-hosted PHP website?"**

---

## 📑 Table of Contents
1. [Executive Summary: Can cPanel Run APS?](#1-executive-summary-can-cpanel-run-aps)
2. [Why Shared Hosting Cannot Host WebSocket Daemons](#2-why-shared-hosting-cannot-host-websocket-daemons)
3. [The Recommended Architecture: Hybrid cPanel + VPS](#3-the-recommended-architecture-hybrid-cpanel--vps)
4. [Step-by-Step Hybrid Setup](#4-step-by-step-hybrid-setup)
   - [Step 1: Set Up APS on a Free / Low-Cost VPS](#step-1-set-up-aps-on-a-free--low-cost-vps)
   - [Step 2: Connect Your Domain DNS](#step-2-connect-your-domain-dns)
   - [Step 3: Trigger Real-Time Events from cPanel PHP](#step-3-trigger-real-time-events-from-cpanel-php)
   - [Step 4: Connect Client Browsers & Mobile Apps](#step-4-connect-client-browsers--mobile-apps)
5. [Frequently Asked Questions (FAQ)](#5-frequently-asked-questions-faq)

---

## 1. Executive Summary: Can cPanel Run APS?

| Capability | Supported on Shared cPanel? | Explanation |
| :--- | :---: | :--- |
| **Running APS WebSocket Server (`./aps all-in-one`)** | ❌ **No** | Shared hosting terminates persistent background processes, disallows root access, blocks custom ports, and enforces strict HTTP request timeouts (typically 30–60s). |
| **Broadcasting Events from cPanel PHP to APS** | ✅ **Yes (100%)** | PHP makes standard outbound HTTP/HTTPS requests (via `curl` or Composer `pusher/pusher-php-server`). This works out of the box with zero special permissions or root access! |
| **Running APS on a cPanel Dedicated Server / VPS (Root Access)** | ✅ **Yes** | If you own a full VPS or Dedicated Server running cPanel with root SSH access, you can run APS as a systemd service or Docker container. |

---

## 2. Why Shared Hosting Cannot Host WebSocket Daemons

WebSockets and persistent real-time servers operate completely differently from traditional PHP request-response lifecycles:

1. **Persistent Connections vs. Ephemeral Requests**:
   - PHP scripts on shared hosting run for a few milliseconds, output HTML/JSON, and terminate immediately.
   - WebSockets require connections to remain open for hours or days with continuous bidirectional ping/pong heartbeats.
2. **Process Watchdogs (CloudLinux / LVE)**:
   - Shared hosting providers use CloudLinux LVE or cPanel process limits to kill background binaries (`kill -9`) that exceed memory or runtime limits.
3. **Port & Reverse Proxy Restrictions**:
   - Shared Apache / LiteSpeed web servers are not configured to proxy WebSocket upgrade headers (`Upgrade: websocket`) to arbitrary user processes.

---

## 3. The Recommended Architecture: Hybrid cPanel + VPS

The industry-standard architecture used by production applications is a **hybrid model**:

```
                  ┌────────────────────────────────────────┐
                  │           End Users (Clients)          │
                  │   Web (pusher-js) / Mobile (Android)   │
                  └───────┬────────────────────────┬───────┘
                          │                        │
       1. Loads Website   │                        │ 3. Persistent WebSocket
       (HTML/CSS/JS/PHP)  │                        │    Connection (WSS)
                          │                        │
               ┌──────────▼──────────┐   ┌─────────▼─────────┐
               │    cPanel Shared    │   │  AWS EC2 / VPS    │
               │       Hosting       │   │  (Runs APS Go)    │
               │                     │   │                   │
               │  • mywebsite.com    │   │ • aps.mywebsite.com│
               │  • PHP / Laravel    │   │ • WebSockets (8080)│
               │  • MySQL Database   │   │ • Beams Push      │
               └──────────┬──────────┘   └─────────▲─────────┘
                          │                        │
                          │ 2. Broadcasts Event    │
                          │    via Outbound HTTPS  │
                          └────────────────────────┘
```

### Why This Hybrid Model Works Best:
- **Zero modification to your cPanel hosting**: Keep your existing domain, PHP code, MySQL database, and email on cPanel.
- **Minimal cost**: A tiny $3.50–$5/month VPS (e.g. AWS EC2 `t4g.micro`, Hetzner, or DigitalOcean) can easily handle **10,000 to 50,000 concurrent WebSockets** with Go.
- **Maximum reliability**: Even if your cPanel web server restarts or experiences high traffic, the real-time WebSocket server remains completely unaffected.

---

## 4. Step-by-Step Hybrid Setup

### Step 1: Set Up APS on a Free / Low-Cost VPS
1. Rent an Ubuntu 22.04 / 24.04 instance on AWS EC2, DigitalOcean, or Hetzner.
2. Build and run APS:
   ```bash
   # Download or clone APS
   git clone https://github.com/khajumsanjog/AdhanPradhanServices.git
   cd AdhanPradhanServices
   go build -o aps ./cmd/aps
   ./aps all-in-one
   ```
3. Set up **Caddy** to automatically handle free Let's Encrypt SSL certificates (see [EC2 Deployment Guide](./ec2-ubuntu.md)).

### Step 2: Connect Your Domain DNS
In your cPanel DNS Zone Editor (or Cloudflare):
- Add an `A` record pointing a subdomain to your VPS IP:
  ```
  Type: A
  Name: aps.mywebsite.com
  Target: <YOUR_VPS_PUBLIC_IP>
  TTL: Auto
  ```

### Step 3: Trigger Real-Time Events from cPanel PHP
In your cPanel file manager or Git repository, install the official Pusher PHP SDK:

```bash
composer require pusher/pusher-php-server
```

In your PHP script (e.g. `order_completed.php`):
```php
<?php
require __DIR__ . '/vendor/autoload.php';

use Pusher\Pusher;

$pusher = new Pusher(
    'aps_key_demo_12345',      // App Key from APS Console
    'aps_secret_demo_67890',   // App Secret from APS Console
    '100001',                  // App ID
    [
        'host' => 'aps.mywebsite.com',
        'port' => 443,
        'scheme' => 'https',
        'useTLS' => true,
        'cluster' => 'mt1'
    ]
);

// Publish real-time event:
$pusher->trigger('orders', 'new-order', [
    'order_id' => 8421,
    'total' => 'Rs. 2,400',
    'status' => 'paid'
]);
```

### Step 4: Connect Client Browsers & Mobile Apps
In your website's frontend JavaScript:
```html
<script src="https://js.pusher.com/8.4/pusher.min.js"></script>
<script>
  const pusher = new Pusher('aps_key_demo_12345', {
    wsHost: 'aps.mywebsite.com',
    wssPort: 443,
    forceTLS: true,
    cluster: 'mt1'
  });

  const channel = pusher.subscribe('orders');
  channel.bind('new-order', function(data) {
    alert('New order received: #' + data.order_id);
  });
</script>
```

---

## 5. Frequently Asked Questions (FAQ)

### Q1: Does my cPanel hosting provider need to open incoming port 8080?
**No.** Your cPanel server only makes *outbound* HTTPS connections to port 443 on your VPS. Outbound port 443 is open by default on all web hosts worldwide.

### Q2: What if I have SSH access on cPanel? Can I run `./aps` inside my cPanel home directory?
Even with SSH access on shared cPanel:
1. You cannot bind to privileged ports (`80` or `443`).
2. CloudLinux / cPanel will kill any long-running binary when your SSH session closes or after a CPU quota limit is reached.
3. It is strongly advised **not** to run long-running daemons on shared hosting.

### Q3: What if my cPanel plan is a "cPanel VPS" or "Dedicated Server"?
If you have root access to the underlying VPS (via `whm` or root SSH):
**Yes!** You can run APS as a systemd service directly on the server alongside cPanel. Configure Caddy or Apache reverse proxy on a dedicated virtual host (`aps.yourdomain.com`).
