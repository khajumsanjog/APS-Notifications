# APS (Aadhan Pradhan Services)

> **A fast, self-hosted real-time WebSocket pub/sub and multi-platform push notification engine written in Go 1.26.4+ — 100% compatible with Pusher Channels & Pusher Beams.**

[![Go Version](https://img.shields.io/badge/Go-1.26.4+-00ADD8?style=flat&logo=go)](https://go.dev)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.4-black?style=flat&logo=next.js)](https://nextjs.org)
[![Pusher Compatible](https://img.shields.io/badge/Pusher-Drop--in%20Replacement-6941C6?style=flat)](https://pusher.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 💡 What is APS in 30 Seconds?

APS gives you everything Pusher provides — without monthly connection limits, message limits, or per-device pricing:

1. **APS Channels (WebSockets)**: Drop-in replacement for `pusher-js` and Pusher server SDKs (Node.js, Python, Go, PHP, etc.). Supports public, private, presence, and encrypted channels.
2. **APS Beams (Push Notifications)**: Multi-platform mobile and web push delivery for FCM (Android & Web) and APNs (iOS) with interest topics and authenticated user targeting.
3. **Developer Console**: Beautiful Next.js 16 dashboard with live event tailing, push testbeds, interactive code snippets, and metrics.
4. **Zero-Config Standalone**: Runs out-of-the-box with built-in in-memory pub/sub and storage, or scales to millions of users with PostgreSQL 16 and Redis 7.

---

## ⚡ 3-Step Quickstart

### Step 1: Start the APS Daemon
```bash
# Clone and build the binary
go build -o aps ./cmd/aps

# Start all services (WebSockets + REST API + Beams Push)
./aps all-in-one
```
APS starts on port `8080` and is ready to accept WebSocket connections and REST requests immediately.

### Step 2: Open the Developer Console
In a second terminal:
```bash
cd dashboard
npm install
npm run dev
```
Open **`http://localhost:3000`** in your browser:
- **Default Email**: `developer@khajumsanjog.com`
- **Default Password**: `password123`

### Step 3: Send Your First Test Event
You can emit a test event directly from your terminal using `curl`:
```bash
curl -X POST http://localhost:8080/apps/100001/events \
  -H "Authorization: Bearer aps_key_demo_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "greeting",
    "channels": ["my-channel"],
    "data": { "message": "Hello from APS!" }
  }'
```
You can also watch it live on the **Live Debug Console** (`http://localhost:3000/dashboard/apps/100001/debug`)!

---

## 💻 2-Minute Code Quickstart

APS uses official, standard Pusher SDKs. You do **not** need any custom client libraries!

### 1. Frontend Web Client (`pusher-js`)
Install the standard Pusher package:
```bash
npm install pusher-js
```

Connect and listen for events:
```javascript
import Pusher from 'pusher-js';

const pusher = new Pusher('aps_key_demo_12345', {
  wsHost: 'localhost', // Or 'aps.khajumsanjog.com' in production
  wsPort: 8080,
  wssPort: 443,
  enabledTransports: ['ws', 'wss'],
  forceTLS: false,     // Set true in production with HTTPS
  cluster: 'mt1',
});

// Subscribe to a channel
const channel = pusher.subscribe('my-channel');

// Listen for incoming events
channel.bind('greeting', (data) => {
  console.log('Real-time message received:', data.message);
});
```

---

### 2. Backend Server (`Node.js`)
Install the Pusher server package:
```bash
npm install pusher
```

Trigger an event from your server:
```javascript
const Pusher = require('pusher');

const pusher = new Pusher({
  appId: '100001',
  key: 'aps_key_demo_12345',
  secret: 'aps_secret_demo_67890',
  host: 'localhost',
  port: '8080',
  useTLS: false,
});

async function notifyUsers() {
  await pusher.trigger('my-channel', 'greeting', {
    message: 'New order received!',
    orderId: 'ORD-9821'
  });
  console.log('Notification sent!');
}

notifyUsers();
```

---

### 3. Backend Server (`Python`)
```python
import pusher

client = pusher.Pusher(
    app_id='100001',
    key='aps_key_demo_12345',
    secret='aps_secret_demo_67890',
    host='localhost',
    port=8080,
    ssl=False
)

client.trigger('my-channel', 'greeting', {'message': 'Hello from Python!'})
```

---

## 📱 Push Notifications (APS Beams)

APS Beams lets you send push notifications to mobile and web apps.

### Step 1: Register a Device (Client-side)
```bash
curl -X POST http://localhost:8080/beams/beams_demo_instance/devices/fcm/register \
  -H "Content-Type: application/json" \
  -d '{
    "token": "DEVICE_FCM_TOKEN_HERE",
    "interests": ["announcements", "donations"]
  }'
```

### Step 2: Send a Push to an Interest/Topic (Server-side)
```bash
curl -X POST http://localhost:8080/beams/beams_demo_instance/publishes/interests \
  -H "Content-Type: application/json" \
  -d '{
    "interests": ["announcements"],
    "fcm": {
      "notification": {
        "title": "Special Announcement",
        "body": "Welcome to our live festival event!"
      }
    }
  }'
```

---

## 🛠️ CLI Tool (`apsctl`)

APS includes a built-in CLI tool to monitor health, tail events, and send test messages:

```bash
# Build the CLI
go build -o apsctl ./cmd/apsctl

# Check service health
./apsctl status

# Live stream events from a channel in your terminal
./apsctl tail aps_key_demo_12345 my-channel

# Trigger a test event via CLI
./apsctl trigger 100001 aps_key_demo_12345 aps_secret_demo_67890 my-channel greeting '{"message":"hello"}'

# Publish a mobile push notification via CLI
./apsctl push beams_demo_instance announcements "Update" "New version available"
```

---

## 📑 API Quick Reference Table

| Action | HTTP Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Trigger Event** | `POST` | `/apps/{app_id}/events` | Broadcast an event to one or more channels |
| **Batch Events** | `POST` | `/apps/{app_id}/batch_events` | Send up to 10 events across channels in 1 call |
| **Occupied Channels** | `GET` | `/apps/{app_id}/channels` | List all active channels & presence counts |
| **Channel Users** | `GET` | `/apps/{app_id}/channels/{name}/users` | List user IDs in a presence channel |
| **Message History** | `GET` | `/apps/{app_id}/channels/{name}/history` | Replay past messages for late-joining clients |
| **Unified Broadcast** | `POST` | `/apps/{app_id}/broadcast` | Broadcast WebSocket event + Beams mobile push |
| **Register Device** | `POST` | `/beams/{instance_id}/devices/fcm/register` | Register FCM push device token |
| **Publish Push** | `POST` | `/beams/{instance_id}/publishes/interests` | Send push notification to a topic |
| **User Push** | `POST` | `/beams/{instance_id}/publishes/users` | Send push to specific authenticated user IDs |
| **List Webhooks** | `GET` | `/api/apps/{app_id}/webhooks` | List configured webhook callbacks |

---

## 📚 Detailed Documentation

For full architectural breakdowns, security rules, and OpenAPI schemas:

- [**OpenAPI 3.0 Specification (Swagger)**](docs/openapi.yaml)
- [**Documentation Overview & Architecture**](docs/README.md)
- [**Pusher Channels & WebSocket Protocol Guide**](docs/api/pusher-channels.md)
- [**APS Beams Push Notification Guide**](docs/api/beams-push.md)
- [**Developer Console Control Plane Reference**](docs/api/dashboard-control-plane.md)
- [**Webhooks & Dead-Letter Replay Reference**](docs/api/webhooks.md) *(Channel occupancy, presence, client & server messages, Beams push delivery & device registration)*

---

## 🚢 Production Deployment with Docker Compose

Deploy the entire production stack (Caddy TLS, Redis 7, PostgreSQL 16, WebSocket hub, and Next.js console) with one command:

```bash
docker compose -f deploy/docker-compose.yml up -d
```
All certificates are automatically issued and managed via Caddy for `aps.khajumsanjog.com`.
