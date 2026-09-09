# APS (Aadhan Pradhan Services)

A self-hosted, Pusher & Pusher Beams compatible real-time and push notification infrastructure platform, written in Go 1.26.4+.

- **Domain**: `aps.khajumsanjog.com`
- **Pusher Protocol**: Pusher v7 WebSocket Protocol & Pusher REST HTTP specification (drop-in replacement for `pusher-js` and server SDKs).
- **Push Engine**: APS Beams (FCM for Android/Web, APNs for iOS) with device interest subscriptions and authenticated user pushes.
- **Developer Console**: Next.js 16 + Tailwind CSS dashboard with live event tailer & push testbed.
- **CLI**: `apsctl` for command-line event tailing, triggering, and health inspection.

---

## 📖 API Documentation & Guides

| Document | Description |
| :--- | :--- |
| [**OpenAPI 3.0 Specification**](docs/openapi.yaml) | Full machine-readable REST API schema for Swagger & Postman |
| [**Docs Overview & Architecture**](docs/README.md) | Platform architecture, service routing, and deployment topologies |
| [**Pusher Channels & Protocol**](docs/api/pusher-channels.md) | WebSocket protocol, HMAC auth, public/private/presence channels, REST trigger |
| [**APS Beams Push Notifications**](docs/api/beams-push.md) | Device token registration, FCM & APNs delivery, interest topics, user pushes |
| [**Developer Console API**](docs/api/dashboard-control-plane.md) | App provisioning, API key management, real-time cluster metrics, JWT auth |
| [**Webhooks & Replay**](docs/api/webhooks.md) | Presence callbacks, client event webhooks, signature verification, dead-letter log |

---

## 1. System Architecture

```
                        ┌─────────────────────────┐
                        │   aps.khajumsanjog.com   │
                        │      (Caddy / TLS)      │
                        └────────────┬────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │ /app/*, /ws/*              │ /apps/*, /api/*            │ /beams/*
┌───────▼────────┐         ┌─────────▼─────────┐        ┌──────────▼─────────┐
│  aps-ws         │         │  aps-api           │        │  aps-beams          │
│  (Pusher v7     │         │  (REST control     │        │  (FCM & APNs push   │
│   WebSocket     │         │   plane & events)  │        │   engine)           │
│   hub)          │         │                    │        │                     │
└───────┬─────────┘         └─────────┬──────────┘        └──────────┬──────────┘
        │                             │                              │
        └─────────────┬───────────────┴────────────────┬─────────────┘
                       │                                │
              ┌────────▼────────┐              ┌────────▼─────────┐
              │  Redis 7        │              │  PostgreSQL 16   │
              │  (pub/sub,      │              │  (apps, keys,    │
              │   presence)     │              │   devices, logs) │
              └─────────────────┘              └──────────────────┘
```

---

## 2. Quick Start

### A. Run Locally (Standalone Mode)
APS includes a zero-dependency fallback that boots instantly with an in-memory database and in-memory pub/sub if external Postgres/Redis instances are not configured:

```bash
# Build the unified binary
go build -o aps ./cmd/aps

# Run the all-in-one daemon (WS + REST API + Beams)
./aps all-in-one
```

Verify health:
```bash
go build -o apsctl ./cmd/apsctl
./apsctl status
# Output: ✅ Status 200 OK — APS is running!
```

### B. Run with Docker Compose
```bash
docker compose -f deploy/docker-compose.yml up -d
```
This orchestrates:
- `caddy`: Reverse proxy with automatic Let's Encrypt TLS for `aps.khajumsanjog.com`
- `aps-ws`: WebSocket node on port 6001
- `aps-api`: REST control plane on port 8080
- `aps-beams`: Push delivery engine on port 8082
- `dashboard`: Next.js 15 developer console on port 3000
- `postgres`: PostgreSQL 16
- `redis`: Redis 7

---

## 3. Drop-in Pusher Client Integration

Configure standard `pusher-js` to point to APS:

```javascript
import Pusher from 'pusher-js';

const pusher = new Pusher('YOUR_APP_KEY', {
  wsHost: 'aps.khajumsanjog.com', // or 'localhost' in dev
  wsPort: 80,                     // or 6001
  wssPort: 443,
  enabledTransports: ['ws', 'wss'],
  forceTLS: true,
  cluster: 'mt1',
});

// Subscribe to public channel
const channel = pusher.subscribe('donations');
channel.bind('donation_received', (data) => {
  console.log('Donation:', data);
});

// Subscribe to private channel (HMAC signed)
const privateChannel = pusher.subscribe('private-account-123');

// Subscribe to presence channel
const presenceChannel = pusher.subscribe('presence-chat-room');
presenceChannel.bind('pusher:member_added', (member) => {
  console.log('Member joined:', member.id);
});
```

---

## 4. Triggering Events (Server SDK)

APS supports official Pusher server SDKs (`pusher-http-node`, `pusher-http-go`, `pusher-http-python`):

```javascript
const Pusher = require('pusher');

const pusher = new Pusher({
  appId: '100001',
  key: 'YOUR_APP_KEY',
  secret: 'YOUR_APP_SECRET',
  host: 'aps.khajumsanjog.com',
  port: 443,
  useTLS: true,
});

pusher.trigger('donations', 'donation_received', {
  donor: 'Ram Sharma',
  amount_npr: 5000
});
```

---

## 5. APS Beams (Push Notifications)

### Device Registration (Android / Web FCM)
```http
POST /beams/{instance_id}/devices/fcm/register
Content-Type: application/json

{
  "token": "device_fcm_token_here",
  "interests": ["donations", "announcements"]
}
```

### Publish to Interests
```http
POST /beams/{instance_id}/publishes/interests
Content-Type: application/json

{
  "interests": ["donations"],
  "fcm": {
    "notification": {
      "title": "Donation Received",
      "body": "NPR 5,000 received via Khajum Sanjog"
    }
  }
}
```

---

## 6. CLI Tool (`apsctl`)

```bash
# Check health
./apsctl status

# Live stream events from a channel
./apsctl tail <app_key> <channel>

# Emit test event via CLI
./apsctl trigger <app_id> <app_key> <app_secret> <channel> <event> '{"msg":"hello"}'

# Publish push notification
./apsctl push <instance_id> <interest> "Title" "Body text"
```

---

## 7. Developer Console Dashboard

Run dashboard in development:
```bash
cd dashboard
npm run dev
```
Navigate to `http://localhost:3000`:
- **App Management**: Create apps, rotate keys, copy secrets.
- **Live Debug Console**: Interactive real-time event tailer and event emitter testbed.
- **APS Beams Push**: Test pushes, inspect registered devices, configure FCM & APNs credentials.
- **Webhooks & Replay**: Webhook endpoints and delivery logs.
- **Message History**: Replay and inspect message history per channel.

---

## 8. Automated Tests

```bash
go test -v ./...
```
All unit and end-to-end integration tests validate Pusher v7 handshake, HMAC signing, presence channels, REST trigger, and APS Beams.
