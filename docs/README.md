# APS (Aadhan Pradhan Services) — Developer Documentation

Welcome to the comprehensive documentation for **APS (Aadhan Pradhan Services)** — a high-performance, self-hosted real-time WebSocket pub/sub and multi-platform push notification engine written in Go 1.26.4+.

APS is 100% protocol-compatible with **Pusher Channels** and **Pusher Beams**, serving as a drop-in replacement for existing applications without requiring code rewrites.

---

## 📚 Documentation Index

| Section | Description | Link |
| :--- | :--- | :--- |
| **OpenAPI Specification** | Machine-readable OpenAPI 3.0 (Swagger) specification | [openapi.yaml](./openapi.yaml) |
| **Pusher Channels & WS Protocol** | WebSocket connection handshake, channels, private/presence HMAC auth, REST trigger APIs | [docs/api/pusher-channels.md](./api/pusher-channels.md) |
| **APS Beams (Push Notifications)** | Multi-platform push engine, FCM, APNs, interest topics, and authenticated user targeting | [docs/api/beams-push.md](./api/beams-push.md) |
| **Developer Console Control Plane** | Authentication, app provisioning, API key rotation, live metrics, and configuration | [docs/api/dashboard-control-plane.md](./api/dashboard-control-plane.md) |
| **Webhooks & Dead-Letter Replay** | Presence and client event webhooks, Pusher HMAC signatures, and retry policies | [docs/api/webhooks.md](./api/webhooks.md) |

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
   - Ingests events from server SDKs (`pusher-http-node`, `pusher-http-go`, etc.) with HMAC-SHA256 verification.
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
   - Used by `pusher-js` to access private and presence channels.
   - Format: `<app_key>:<hmac_sha256(socket_id + ":" + channel_name, app_secret)>`.
3. **Bearer Tokens (Dashboard & Developer API)**:
   - Standard HTTP header: `Authorization: Bearer <jwt_or_api_key>`.
   - Used for console interactions, API keys, and dashboard administration.
