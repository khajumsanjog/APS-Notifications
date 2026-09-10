# Docker Compose Production Deployment Guide — APS

Deploy APS (Aadhan Pradhan Services) with **Docker & Docker Compose** for high-scale, multi-container deployments featuring **PostgreSQL 16, Redis 7, Caddy automatic TLS, and Next.js 16 Console**.

---

## 📑 Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Configuration & Environment Variables](#3-configuration--environment-variables)
4. [The `docker-compose.yml` File](#4-the-docker-composeyml-file)
5. [Starting the Services](#5-starting-the-services)
6. [Scaling & High Availability](#6-scaling--high-availability)
7. [Database Backups & Maintenance](#7-database-backups--maintenance)

---

## 1. Architecture Overview

The production Docker Compose stack provides enterprise-grade isolation:

```
                  ┌────────────────────────────────────────┐
                  │                 Internet               │
                  └───────────────────┬────────────────────┘
                                      │ Ports 80 & 443
                               ┌──────▼──────┐
                               │    Caddy    │ (Auto-TLS Reverse Proxy)
                               └──────┬──────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               │                                             │
      ┌────────▼────────┐                           ┌────────▼─────────┐
      │     aps-ws      │ (WebSockets & Events)     │  aps-dashboard   │ (Next.js 16)
      └────────┬────────┘                           └──────────────────┘
               │
       ┌───────┴───────┐
┌──────▼──────┐ ┌──────▼──────┐
│  Redis 7    │ │ PostgreSQL  │
│  (Pub/Sub)  │ │ (Database)  │
└─────────────┘ └─────────────┘
```

---

## 2. Prerequisites

- Docker Engine 24.0+
- Docker Compose v2.20+
- A public domain with DNS records pointing to your server (e.g. `aps.yourdomain.com`).

---

## 3. Configuration & Environment Variables

In your APS project directory, create `.env.production`:

```env
# Domain Configuration for Caddy SSL
DOMAIN=aps.khajumsanjog.com
DASHBOARD_DOMAIN=dashboard.khajumsanjog.com
ACME_EMAIL=admin@khajumsanjog.com

# PostgreSQL Configuration
POSTGRES_DB=aps_db
POSTGRES_USER=aps_user
POSTGRES_PASSWORD=SuperSecretDbPassword123!
DATABASE_URL=postgres://aps_user:SuperSecretDbPassword123!@postgres:5432/aps_db?sslmode=disable

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# APS Server Configuration
PORT=8080
GIN_MODE=release
JWT_SECRET=super-secret-jwt-signing-key-at-least-32-chars-long
```

---

## 4. The `docker-compose.yml` File

Located in `deploy/docker-compose.yml`:

```yaml
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - aps
      - dashboard

  aps:
    build:
      context: ..
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - GIN_MODE=release
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    expose:
      - "8080"

  dashboard:
    build:
      context: ../dashboard
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_API_URL=https://${DOMAIN}
      - NODE_ENV=production
    expose:
      - "3000"

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  caddy_data:
  caddy_config:
  postgres_data:
  redis_data:
```

---

## 5. Starting the Services

```bash
# Navigate to deploy directory
cd deploy

# Start all containers in detached mode
docker compose --env-file ../.env.production up -d --build

# Verify container status
docker compose ps

# View live aggregate logs
docker compose logs -f
```

---

## 6. Scaling & High Availability

Because APS uses Redis Pub/Sub for cross-node synchronization, you can scale the WebSocket engine horizontally across multiple containers with zero state leakage:

```bash
docker compose up -d --scale aps=3
```

Caddy will automatically load-balance incoming WebSocket and HTTP connections across the 3 APS instances.

---

## 7. Database Backups & Maintenance

### Creating an Automated Backup:
```bash
docker compose exec -T postgres pg_dump -U aps_user aps_db > backup_$(date +%Y%m%d).sql
```

### Restoring from Backup:
```bash
docker compose exec -T postgres psql -U aps_user -d aps_db < backup_20260910.sql
```
