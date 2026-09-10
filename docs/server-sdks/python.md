# Python Server Guide — APS Channels

Complete server-side integration guide for publishing real-time events, authenticating private channels, and validating webhooks in **Django, FastAPI, and Flask** using the official `pusher` Python package.

---

## 📑 Table of Contents
1. [Installation](#1-installation)
2. [Initialization](#2-initialization)
3. [Triggering Events](#3-triggering-events)
   - [Single Event](#31-single-event)
   - [Multi-Channel & Batch Events](#32-multi-channel--batch-events)
   - [Excluding Triggering Socket](#33-excluding-triggering-socket)
4. [Channel Authentication (Private & Presence)](#4-channel-authentication-private--presence)
   - [FastAPI Example](#41-fastapi-example)
   - [Django Example](#42-django-example)
   - [Flask Example](#43-flask-example)
5. [Querying Channel State](#5-querying-channel-state)
6. [Webhook Verification](#6-webhook-verification)
7. [APS Beams Push Notifications via Python](#7-aps-beams-push-notifications-via-python)

---

## 1. Installation

Install the official Pusher server SDK:

```bash
pip install pusher
```

---

## 2. Initialization

Configure the client with your APS endpoint:

```python
import os
import pusher

pusher_client = pusher.Pusher(
    app_id=os.getenv('APS_APP_ID', '100001'),
    key=os.getenv('APS_APP_KEY', 'aps_key_demo_12345'),
    secret=os.getenv('APS_APP_SECRET', 'aps_secret_demo_67890'),
    host=os.getenv('APS_HOST', 'aps.khajumsanjog.com'), # 'localhost' in dev
    port=int(os.getenv('APS_PORT', 443)),                # 8080 in dev
    ssl=os.getenv('APS_SSL', 'true').lower() == 'true', # False in dev
    cluster='mt1'
)
```

---

## 3. Triggering Events

### 3.1 Single Event
```python
pusher_client.trigger(
    channels='orders',
    event_name='order_placed',
    data={
        'order_id': 'ORD-9821',
        'total': 1850.00,
        'status': 'confirmed'
    }
)
```

### 3.2 Multi-Channel & Batch Events
```python
# Broadcast to multiple channels:
pusher_client.trigger(['orders', 'kitchen-display'], 'new_ticket', {'id': 105})

# Trigger distinct batch events in 1 network call:
batch_events = [
    {'channel': 'orders', 'name': 'status', 'data': {'id': 101, 'status': 'ready'}},
    {'channel': 'drivers', 'name': 'dispatch', 'data': {'id': 101, 'driver_id': 14}},
]
pusher_client.trigger_batch(batch_events)
```

### 3.3 Excluding Triggering Socket
```python
# Prevent the initiating sender from receiving their own message back:
pusher_client.trigger(
    'chat-room',
    'new_message',
    {'sender': 'Bob', 'text': 'Hey there!'},
    socket_id='1234.5678'
)
```

---

## 4. Channel Authentication (Private & Presence)

### 4.1 FastAPI Example

```python
from fastapi import FastAPI, Form, HTTPException, Depends
from fastapi.responses import JSONResponse

app = FastAPI()

@app.post("/api/broadcasting/auth")
async def authenticate_channel(
    channel_name: str = Form(...),
    socket_id: str = Form(...)
):
    # 1. Verify user session / JWT (e.g. from headers)
    user_id = "user_42"
    user_name = "Maya Devi"

    # 2. Authenticate presence channel:
    if channel_name.startswith("presence-"):
        custom_data = {
            "user_id": user_id,
            "user_info": {"name": user_name, "role": "admin"}
        }
        auth = pusher_client.authenticate(
            channel=channel_name,
            socket_id=socket_id,
            custom_data=custom_data
        )
        return JSONResponse(content=auth)

    # 3. Authenticate private channel:
    auth = pusher_client.authenticate(channel=channel_name, socket_id=socket_id)
    return JSONResponse(content=auth)
```

### 4.2 Django Example

```python
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def pusher_auth(request):
    if not request.user.is_authenticated:
        return HttpResponseForbidden("User not authenticated")

    channel_name = request.POST.get("channel_name")
    socket_id = request.POST.get("socket_id")

    if channel_name.startswith("presence-"):
        auth = pusher_client.authenticate(
            channel=channel_name,
            socket_id=socket_id,
            custom_data={
                "user_id": str(request.user.id),
                "user_info": {"username": request.user.username}
            }
        )
    else:
        auth = pusher_client.authenticate(channel=channel_name, socket_id=socket_id)

    return JsonResponse(auth)
```

### 4.3 Flask Example

```python
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

@app.route("/api/broadcasting/auth", methods=["POST"])
def auth():
    channel_name = request.form.get("channel_name")
    socket_id = request.form.get("socket_id")

    # Verify session...
    auth = pusher_client.authenticate(channel=channel_name, socket_id=socket_id)
    return jsonify(auth)
```

---

## 5. Querying Channel State

Inspect channels and connected users in real time:

```python
# 1. List occupied channels:
channels = pusher_client.channels_info(prefix_filter="orders")
print("Occupied order channels:", channels)

# 2. Get info on a specific channel:
info = pusher_client.channel_info("presence-chat-room", ["user_count"])
print("Active users in room:", info["user_count"])

# 3. List presence users:
users = pusher_client.users_info("presence-chat-room")
print("Presence users:", users["users"])
```

---

## 6. Webhook Verification

Verify incoming webhooks from APS using your app secret:

```python
import hmac
import hashlib

def verify_webhook(body_bytes: bytes, signature_header: str, app_secret: str) -> bool:
    expected_sig = hmac.new(
        app_secret.encode('utf-8'),
        body_bytes,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_sig, signature_header)
```

---

## 7. APS Beams Push Notifications via Python

Publish mobile push notifications to Android and iOS devices using standard `requests` or `httpx`:

```python
import requests

def send_push_notification(interest: str, title: str, body: str):
    instance_id = "beams_demo_instance"
    secret_key = "aps_beams_secret_123"

    url = f"https://aps.khajumsanjog.com/beams/{instance_id}/publishes/interests"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {secret_key}"
    }
    payload = {
        "interests": [interest],
        "fcm": {
            "notification": {
                "title": title,
                "body": body
            }
        },
        "apns": {
            "aps": {
                "alert": {
                    "title": title,
                    "body": body
                },
                "sound": "default"
            }
        }
    }

    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    print("Push dispatched successfully:", response.json())
```
