# APS (Aadhan Pradhan Services) — Developer Documentation

Welcome to the official developer documentation portal for **APS (Aadhan Pradhan Services)** — an enterprise-grade, high-performance, self-hosted real-time WebSocket pub/sub and multi-platform push notification engine written in Go 1.26.4+.

APS is 100% protocol-compatible with **Pusher Channels** and **Pusher Beams**, serving as a drop-in replacement for existing applications without requiring proprietary SDKs or code rewrites.

---

## 📚 Complete Documentation Index

### 📱 Client SDK Guides
Complete, copy-paste ready integration tutorials for mobile and web frontends:

| Platform / Framework | Supported Versions | Key Topics | Guide Link |
| :--- | :--- | :--- | :--- |
| **Android (Kotlin & Java)** | Android 7.0+ (API 24+) | Cleartext config (`10.0.2.2`), `pusher-java-client`, private/presence channels, FCM push token registration | [📘 Android SDK Guide](./client-sdks/android.md) |
| **JavaScript & Web** | Vanilla JS, React, Next.js, Vue | `pusher-js`, custom React hooks (`useApsChannel`), SSR setup, private/presence auth | [📘 JavaScript SDK Guide](./client-sdks/javascript.md) |
| **iOS (Swift)** | iOS 13.0+, macOS | `PusherSwift`, SPM & CocoaPods, ATS cleartext bypass for simulator, APNs token registration | [📘 iOS Swift Guide](./client-sdks/ios.md) |
| **Flutter (Dart)** | Android, iOS, Web | `pusher_channels_flutter`, permissions, StreamController architecture, background FCM push | [📘 Flutter Guide](./client-sdks/flutter.md) |

---

### 🖥️ Server SDK Guides
Guides for backend services publishing real-time events and authorizing client subscriptions:

| Backend Technology | Supported Frameworks | Key Topics | Guide Link |
| :--- | :--- | :--- | :--- |
| **PHP & Laravel** | Laravel 8-11, Symfony, Raw PHP | Native `broadcasting.php` driver, channel authorization, batch triggers, cPanel compatibility | [📘 PHP & Laravel Guide](./server-sdks/php.md) |
| **Node.js & TypeScript** | Express, NestJS, Next.js App Router | `pusher` npm package, batch triggers, `socket_id` exclusion, webhook HMAC verification | [📘 Node.js Guide](./server-sdks/nodejs.md) |
| **Python** | FastAPI, Django, Flask | `pusher` Python SDK, private/presence HMAC auth, channel occupancy queries, webhook validation | [📘 Python Guide](./server-sdks/python.md) |

---

### 📡 API & Protocol Specifications
Underlying wire protocols, REST specifications, and webhook formats:

| Section | Description | Guide Link |
| :--- | :--- | :--- |
| **OpenAPI 3.0 Specification** | Machine-readable Swagger/OpenAPI 3.0 specification file | [📄 openapi.yaml](./openapi.yaml) |
| **Pusher Channels & WS Protocol** | WebSocket connection handshake, channels, private/presence HMAC auth, REST trigger APIs | [📘 Channels & Protocol](./api/pusher-channels.md) |
| **APS Beams (Push Notifications)** | Multi-platform push engine, FCM HTTP v1, APNs HTTP/2, interest topics, and authenticated user targeting | [📘 Beams Push Guide](./api/beams-push.md) |
| **Developer Console Control Plane** | Authentication, app provisioning, API key rotation, live metrics, and configuration | [📘 Control Plane Reference](./api/dashboard-control-plane.md) |
| **Webhooks & Dead-Letter Replay** | Presence and client event webhooks, Pusher HMAC signatures, and retry policies | [📘 Webhooks & DLQ](./api/webhooks.md) |

---

### 🌐 Deployment & Hosting Guides
Production-ready deployment setups for cloud providers, VPS, and shared hosting:

| Environment | Highlights | Guide Link |
| :--- | :--- | :--- |
| **cPanel Shared Hosting** | Explains why shared hosting cannot run WebSockets directly, and provides the step-by-step hybrid architecture (cPanel PHP + cheap VPS) | [🚀 cPanel Hosting Guide](./deployment/cpanel-shared-hosting.md) |
| **AWS EC2 & Ubuntu VPS** | Sizing (`t4g.micro`), Security Groups, systemd service daemon, Caddy automatic TLS, zero-downtime updates | [🚀 AWS EC2 Guide](./deployment/ec2-ubuntu.md) |
| **Docker Compose** | Multi-container stack with PostgreSQL 16, Redis 7, Caddy auto-TLS, horizontal WebSocket scaling | [🚀 Docker Compose Guide](./deployment/docker-compose.md) |

---

## 🏛️ Platform Architecture

APS is organized into three decoupled microservices (or can run as a single unified `all-in-one` binary):

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

1. **`aps-ws` (WebSocket Hub)**:
   - Implements Pusher v7 WebSocket protocol over raw TCP WebSockets.
   - Handles public, private (`private-*`), presence (`presence-*`), and encrypted (`private-encrypted-*`) channels.
   - Built with Gorilla WebSocket, connection heartbeats (`ping`/`pong`), and connection pooling.
2. **`aps-api` (Control Plane & Ingestion)**:
   - Ingests events from server SDKs (`pusher-http-node`, `pusher-http-go`, `pusher-php-server`, etc.) with HMAC-SHA256 verification.
   - Exposes developer dashboard APIs with JWT authentication.
   - Broadcasts events across clusters via Redis Pub/Sub.
3. **`aps-beams` (Mobile & Web Push Engine)**:
   - Delivers push notifications to Android & Web (Firebase Cloud Messaging - HTTP v1 API) and iOS (Apple Push Notification Service - HTTP/2 API).
   - Manages device registrations, interest/topic subscriptions, and authenticated user targeting.

---

## 🔌 Default Ports & Service Routing

| Service | Port | Description |
| :--- | :--- | :--- |
| **All-in-One Daemon** | `8080` | Multiplexes WS (`/app/*`), REST (`/apps/*`, `/api/*`), and Beams (`/beams/*`) on one port |
| **aps-ws** | `6001` | Dedicated WebSocket port when running in distributed mode |
| **aps-api** | `8080` | Dedicated REST control plane port |
| **aps-beams** | `8082` | Dedicated Push Notification engine port |
| **Developer Console** | `3000` | Next.js 16 management dashboard |
| **PostgreSQL** | `5432` | Relational store (apps, keys, devices, history) |
| **Redis** | `6379` | Multi-node horizontal scaling and pub/sub bus |

---

## 🔐 Authentication Overview

APS supports three distinct authentication methods:

1. **Pusher HMAC-SHA256 Signatures (Server-to-Server)**:
   - Used by official Pusher server SDKs when triggering events.
   - Standard query parameters: `auth_key`, `auth_timestamp`, `auth_version`, `auth_signature`, `body_md5`.
2. **Channel Authorization Signatures (Client-to-Server)**:
   - Used by `pusher-js`, `pusher-java-client`, and `PusherSwift` to access private and presence channels.
   - Format: `<app_key>:<hmac_sha256(socket_id + ":" + channel_name, app_secret)>`.
3. **Bearer Tokens (Dashboard & Developer API)**:
   - Standard HTTP header: `Authorization: Bearer <jwt_or_api_key>`.
   - Used for console interactions, API keys, and dashboard administration.

---

## ⚡ Quick Examples Cheat Sheet

### 1. Web Client (`pusher-js`)
```javascript
import Pusher from 'pusher-js';

const pusher = new Pusher('aps_key_demo_12345', {
  wsHost: 'localhost',
  wsPort: 8080,
  forceTLS: false,
  cluster: 'mt1',
});

const channel = pusher.subscribe('donations');
channel.bind('donation_received', (data) => console.log('Event:', data));
```

### 2. Backend Server (`Node.js`)
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

pusher.trigger('donations', 'donation_received', { amount_npr: 5000 });
```

### 3. Send Push Notification via `curl`
```bash
curl -X POST http://localhost:8080/beams/beams_demo_instance/publishes/interests \
  -H "Content-Type: application/json" \
  -d '{
    "interests": ["donations"],
    "fcm": { "notification": { "title": "Update", "body": "New donation received!" } }
  }'
```
