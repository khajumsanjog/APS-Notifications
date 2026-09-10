# Node.js & TypeScript Server Guide — APS Channels

Complete server-side integration guide for publishing real-time events and verifying webhooks from **Node.js, Express, Fastify, NestJS, and Next.js API Routes** using the official `pusher` SDK.

---

## 📑 Table of Contents
1. [Installation](#1-installation)
2. [Initialization](#2-initialization)
3. [Triggering Events](#3-triggering-events)
   - [Single Channel Trigger](#31-single-channel-trigger)
   - [Multi-Channel & Batch Events](#32-multi-channel--batch-events)
   - [Excluding the Triggering Socket](#33-excluding-the-triggering-socket)
4. [Channel Authorization (Private & Presence)](#4-channel-authorization-private--presence)
   - [Express / Fastify Route](#41-express--fastify-route)
   - [Next.js App Router API Route](#42-nextjs-app-router-api-route)
5. [Querying Channel State](#5-querying-channel-state)
   - [List Occupied Channels](#51-list-occupied-channels)
   - [Get Channel Details & User Count](#52-get-channel-details--user-count)
   - [List Presence Channel Users](#53-list-presence-channel-users)
6. [Webhook Verification & Handling](#6-webhook-verification--handling)
7. [Publishing APS Beams Mobile Push via Node.js](#7-publishing-aps-beams-mobile-push-via-nodejs)

---

## 1. Installation

Install the official Pusher HTTP client library:

```bash
npm install pusher
# or
yarn add pusher
# or
pnpm add pusher
```

---

## 2. Initialization

Configure the client to point to your APS server instance:

```typescript
import Pusher from 'pusher';

export const pusher = new Pusher({
  appId: process.env.APS_APP_ID || '100001',
  key: process.env.APS_APP_KEY || 'aps_key_demo_12345',
  secret: process.env.APS_APP_SECRET || 'aps_secret_demo_67890',
  host: process.env.APS_HOST || 'aps.khajumsanjog.com', // or 'localhost' in dev
  port: process.env.APS_PORT || '443',                   // or '8080' in dev
  useTLS: process.env.APS_USE_TLS === 'true',            // false in dev without SSL
  cluster: 'mt1',
});
```

---

## 3. Triggering Events

### 3.1 Single Channel Trigger

```typescript
await pusher.trigger('orders', 'order-placed', {
  orderId: 'ORD-9821',
  amount: 2500,
  customerName: 'Aarav Sharma',
  timestamp: new Date().toISOString(),
});
```

### 3.2 Multi-Channel & Batch Events

Send events to multiple channels at once, or trigger up to 10 distinct events in a single HTTP batch request:

```typescript
// Broadcast same event to 3 channels:
await pusher.trigger(['orders', 'kitchen-display', 'finance'], 'order-placed', {
  orderId: 'ORD-9821',
});

// Trigger distinct events in one batch call:
await pusher.triggerBatch([
  {
    channel: 'orders',
    name: 'order-status-updated',
    data: { orderId: 'ORD-9821', status: 'preparing' },
  },
  {
    channel: 'driver-dispatch',
    name: 'new-pickup-available',
    data: { orderId: 'ORD-9821', pickupLocation: 'Downtown Branch' },
  },
]);
```

### 3.3 Excluding the Triggering Socket

When a client initiates an action, pass their `socket_id` to prevent them from receiving their own echoed event:

```typescript
const socketId = req.body.socket_id;

await pusher.trigger('chat-room', 'new-message', {
  sender: 'Alice',
  text: 'Hello world!',
}, { socket_id: socketId });
```

---

## 4. Channel Authorization (Private & Presence)

### 4.1 Express / Fastify Route

```typescript
import express, { Request, Response } from 'express';
import { pusher } from './pusher';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.post('/api/broadcasting/auth', (req: Request, res: Response) => {
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;

  // 1. Authenticate user from session or JWT:
  const user = (req as any).user;
  if (!user) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 2. Presence Channel:
  if (channel.startsWith('presence-')) {
    const presenceData = {
      user_id: String(user.id),
      user_info: {
        name: user.name,
        email: user.email,
        avatar: user.avatarUrl,
      },
    };
    const auth = pusher.authorizeChannel(socketId, channel, presenceData);
    return res.send(auth);
  }

  // 3. Private Channel:
  const auth = pusher.authorizeChannel(socketId, channel);
  res.send(auth);
});
```

### 4.2 Next.js App Router API Route (`app/api/broadcasting/auth/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { pusher } from '@/lib/pusher';
import { getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const socketId = formData.get('socket_id') as string;
  const channelName = formData.get('channel_name') as string;

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (channelName.startsWith('presence-')) {
    const auth = pusher.authorizeChannel(socketId, channelName, {
      user_id: user.id,
      user_info: { name: user.name },
    });
    return NextResponse.json(auth);
  }

  const auth = pusher.authorizeChannel(socketId, channelName);
  return NextResponse.json(auth);
}
```

---

## 5. Querying Channel State

APS supports the full Pusher REST query API:

### 5.1 List Occupied Channels
```typescript
const response = await pusher.get({ path: '/channels' });
const channels = await response.json();
console.log('Active channels:', channels);
```

### 5.2 Get Channel Details & User Count
```typescript
const response = await pusher.get({
  path: '/channels/presence-chat',
  params: { info: 'user_count' },
});
const channelInfo = await response.json();
console.log('Users in room:', channelInfo.user_count);
```

### 5.3 List Presence Channel Users
```typescript
const response = await pusher.get({ path: '/channels/presence-chat/users' });
const users = await response.json();
console.log('Active user IDs:', users.users);
```

---

## 6. Webhook Verification & Handling

When APS emits webhooks (`channel_vacated`, `channel_occupied`, `member_added`, `member_removed`, `client_event`), verify the HMAC-SHA256 signature using the SDK:

```typescript
import crypto from 'crypto';

app.post('/api/webhooks/aps', (req: Request, res: Response) => {
  const webhookSignature = req.headers['x-pusher-signature'] as string;
  const webhookKey = req.headers['x-pusher-key'] as string;
  const rawBody = JSON.stringify(req.body);

  // Verify HMAC-SHA256:
  const expectedSignature = crypto
    .createHmac('sha256', process.env.APS_APP_SECRET!)
    .update(rawBody)
    .digest('hex');

  if (webhookSignature !== expectedSignature) {
    return res.status(401).send('Invalid signature');
  }

  // Handle events:
  for (const event of req.body.events) {
    switch (event.name) {
      case 'channel_occupied':
        console.log(`Channel ${event.channel} is now active`);
        break;
      case 'channel_vacated':
        console.log(`Channel ${event.channel} has no more subscribers`);
        break;
      case 'member_added':
        console.log(`User ${event.user_id} joined ${event.channel}`);
        break;
      case 'member_removed':
        console.log(`User ${event.user_id} left ${event.channel}`);
        break;
    }
  }

  res.status(200).send('OK');
});
```

---

## 7. Publishing APS Beams Mobile Push via Node.js

You can publish to APS Beams directly using standard `fetch` or `axios`:

```typescript
async function publishPushToInterest(interest: string, title: string, body: string) {
  const instanceId = process.env.APS_BEAMS_INSTANCE_ID || 'beams_demo_instance';
  const secretKey = process.env.APS_BEAMS_SECRET_KEY || 'aps_beams_secret_123';

  const response = await fetch(`https://aps.khajumsanjog.com/beams/${instanceId}/publishes/interests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secretKey}`,
    },
    body: JSON.stringify({
      interests: [interest],
      fcm: {
        notification: { title, body },
        data: { click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      },
      apns: {
        aps: {
          alert: { title, body },
          sound: 'default',
        },
      },
    }),
  });

  const result = await response.json();
  console.log('Beams publish ID:', result.publish_id);
}
```
