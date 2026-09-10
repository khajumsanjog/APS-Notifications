# JavaScript & Web SDK Guide — APS Channels

Complete integration guide for building real-time web applications with APS using the standard `pusher-js` client library.

Works seamlessly with **React, Next.js, Vue, Angular, Svelte, and Vanilla JavaScript**.

---

## 📑 Table of Contents
1. [Installation](#1-installation)
2. [Initialization & Connection](#2-initialization--connection)
3. [Subscribing to Channels](#3-subscribing-to-channels)
   - [Public Channels](#31-public-channels)
   - [Private Channels (Auth)](#32-private-channels)
   - [Presence Channels (Who's Online)](#33-presence-channels)
4. [React & Next.js Integration](#4-react--nextjs-integration)
5. [Connection State Lifecycle](#5-connection-state-lifecycle)
6. [Best Practices & Security](#6-best-practices--security)

---

## 1. Installation

Install the official Pusher browser library:

```bash
# npm
npm install pusher-js

# yarn
yarn add pusher-js

# pnpm
pnpm add pusher-js
```

Or via CDN for vanilla HTML:
```html
<script src="https://js.pusher.com/8.4/pusher.min.js"></script>
```

---

## 2. Initialization & Connection

Point the client to your APS server host and port:

```javascript
import Pusher from 'pusher-js';

// Enable console logging in development:
// Pusher.logToConsole = true;

const pusher = new Pusher('YOUR_APP_KEY', {
  wsHost: 'aps.khajumsanjog.com', // Or 'localhost' for local development
  wsPort: 8080,                   // Plain HTTP/WS port
  wssPort: 443,                   // Secure HTTPS/WSS port
  enabledTransports: ['ws', 'wss'],
  forceTLS: true,                 // Set false for local testing without SSL
  cluster: 'mt1',
});
```

---

## 3. Subscribing to Channels

### 3.1 Public Channels
```javascript
const channel = pusher.subscribe('news-feed');

channel.bind('breaking_news', (data) => {
  console.log('Received real-time update:', data);
});
```

### 3.2 Private Channels
Private channels (`private-*`) require user authentication via your backend API:

```javascript
const pusher = new Pusher('YOUR_APP_KEY', {
  wsHost: 'aps.khajumsanjog.com',
  wssPort: 443,
  forceTLS: true,
  cluster: 'mt1',
  // Authentication endpoint on your backend:
  authEndpoint: '/api/broadcasting/auth',
  auth: {
    headers: {
      Authorization: 'Bearer ' + userToken,
    },
  },
});

const privateChannel = pusher.subscribe('private-orders-1001');

privateChannel.bind('order_status', (data) => {
  console.log('Private order update:', data);
});
```

### 3.3 Presence Channels
Presence channels (`presence-*`) show active users in a chat room, document, or game:

```javascript
const presenceChannel = pusher.subscribe('presence-chat-room');

// Member list on initial join:
presenceChannel.bind('pusher:subscription_succeeded', (members) => {
  console.log('Total members online:', members.count);
  members.each((member) => {
    console.log('Member:', member.id, member.info);
  });
});

// Member joined:
presenceChannel.bind('pusher:member_added', (member) => {
  console.log('User joined:', member.id, member.info);
});

// Member left:
presenceChannel.bind('pusher:member_removed', (member) => {
  console.log('User left:', member.id);
});

// Chat message event:
presenceChannel.bind('new_message', (data) => {
  console.log('New message:', data.text);
});
```

---

## 4. React & Next.js Integration

### Custom React Hook: `useApsChannel`
```typescript
// hooks/useApsChannel.ts
import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';

let pusherClient: Pusher | null = null;

export function getPusherClient() {
  if (!pusherClient && typeof window !== 'undefined') {
    pusherClient = new Pusher(process.env.NEXT_PUBLIC_APS_KEY!, {
      wsHost: process.env.NEXT_PUBLIC_APS_HOST || 'localhost',
      wsPort: Number(process.env.NEXT_PUBLIC_APS_PORT) || 8080,
      wssPort: 443,
      enabledTransports: ['ws', 'wss'],
      forceTLS: process.env.NODE_ENV === 'production',
      cluster: 'mt1',
    });
  }
  return pusherClient;
}

export function useApsChannel(channelName: string, eventName: string, onEvent: (data: any) => void) {
  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    const channel = client.subscribe(channelName);
    channel.bind(eventName, onEvent);

    return () => {
      channel.unbind(eventName, onEvent);
      client.unsubscribe(channelName);
    };
  }, [channelName, eventName, onEvent]);
}
```

### Using in a Component:
```tsx
// components/LiveOrders.tsx
'use client';

import { useState } from 'react';
import { useApsChannel } from '@/hooks/useApsChannel';

export default function LiveOrders() {
  const [orders, setOrders] = useState<any[]>([]);

  useApsChannel('orders', 'new_order', (newOrder) => {
    setOrders((prev) => [newOrder, ...prev]);
  });

  return (
    <div>
      <h3>Live Incoming Orders ({orders.length})</h3>
      <ul>
        {orders.map((o) => (
          <li key={o.id}>{o.item} — ${o.price}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 5. Connection State Lifecycle

Monitor connection changes to show online/offline indicators:

```javascript
pusher.connection.bind('state_change', (states) => {
  // states.previous, states.current
  console.log(`Connection state: ${states.current}`);
});

pusher.connection.bind('connected', () => {
  console.log('Real-time connected! Socket ID:', pusher.connection.socket_id);
});

pusher.connection.bind('disconnected', () => {
  console.log('Real-time disconnected.');
});
```

---

## 6. Disconnecting

To prevent memory leaks when navigating away in Single Page Applications (SPAs):

```javascript
pusher.unsubscribe('news-feed');
pusher.disconnect();
```
