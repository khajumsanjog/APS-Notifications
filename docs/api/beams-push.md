# APS Beams Push Notification API Reference

**APS Beams** is a multi-platform push notification engine designed as a drop-in replacement for Pusher Beams. It manages device registration, topic/interest subscriptions, authenticated user targeting, and outbound delivery through **Firebase Cloud Messaging (FCM)** and **Apple Push Notification Service (APNs)**.

---

## 1. Core Concepts

- **Instance ID**: A unique identifier for your push notification application (e.g. `beams_demo_instance`).
- **Device ID**: A unique token created when a device registers (e.g. `fcm-8bf9a2...` or `apns-7ce3d1...`).
- **Interests**: Topic channels (e.g. `donations`, `announcements`, `orders`) that devices subscribe to.
- **Authenticated Users**: Direct targeting to specific logged-in user IDs (e.g. `usr_1001`), delivering to all devices owned by that user.
- **AES-256-GCM Encryption**: Push provider keys (FCM service account credentials, APNs `.p8` keys) are encrypted at rest using an AES-256-GCM master key.

---

## 2. Device Registration API

Mobile and Web apps register their platform tokens with the APS Beams server.

### `POST /beams/{instance_id}/devices/fcm/register`
Register an Android or Web Push FCM device token.

#### Request Body
```json
{
  "token": "dK82n-fcm-device-registration-token-here",
  "user_id": "usr_1001",
  "interests": ["donations", "announcements"],
  "metadata": {
    "app_version": "1.2.0",
    "os": "Android 14"
  }
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `token` | `string` | The FCM device registration token (required) |
| `user_id` | `string` | Optional authenticated user ID to link to this device |
| `interests` | `string[]` | Initial interests/topics to subscribe to |
| `metadata` | `object` | Optional custom client metadata |

#### Response (`201 Created`)
```json
{
  "device_id": "fcm-8d2a1bf9c4e20981aef10284",
  "instance_id": "beams_demo_instance",
  "platform": "fcm",
  "token": "dK82n-fcm-device-registration-token-here",
  "user_id": "usr_1001",
  "interests": ["donations", "announcements"],
  "created_at": "2026-09-09T22:30:00Z",
  "updated_at": "2026-09-09T22:30:00Z"
}
```

---

### `POST /beams/{instance_id}/devices/apns/register`
Register an iOS device APNs token.

#### Request Body
```json
{
  "token": "79b48f...apns-hex-device-token",
  "user_id": "usr_1001",
  "interests": ["announcements"]
}
```

#### Response (`201 Created`)
```json
{
  "device_id": "apns-3fe1892c9082a17fcd918371",
  "instance_id": "beams_demo_instance",
  "platform": "apns",
  "token": "79b48f...apns-hex-device-token",
  "user_id": "usr_1001",
  "interests": ["announcements"],
  "created_at": "2026-09-09T22:30:00Z",
  "updated_at": "2026-09-09T22:30:00Z"
}
```

---

### `DELETE /beams/{instance_id}/devices/{device_id}`
Deregister a device token when a user logs out or uninstalls the app.

#### Response (`204 No Content`)

---

### `PUT /beams/{instance_id}/devices/{device_id}/interests`
Replace the complete list of subscribed interests for a device.

#### Request Body
```json
{
  "interests": ["orders", "deals", "updates"]
}
```

#### Response (`200 OK`)
```json
{
  "status": "updated",
  "interests": ["orders", "deals", "updates"]
}
```

---

## 3. Push Publishing API

Publish push notifications from your backend server or cron jobs.

### `POST /beams/{instance_id}/publishes/interests`
Publish a push notification to all devices subscribed to one or more interests.

#### Request Body
```json
{
  "interests": ["donations", "announcements"],
  "fcm": {
    "notification": {
      "title": "New Donation Received",
      "body": "NPR 5,000 was contributed to Khajum Sanjog!"
    },
    "data": {
      "action": "open_donation_details",
      "donation_id": "don_8829"
    }
  },
  "apns": {
    "aps": {
      "alert": {
        "title": "New Donation Received",
        "body": "NPR 5,000 was contributed to Khajum Sanjog!"
      },
      "badge": 1,
      "sound": "default"
    },
    "custom_data": {
      "donation_id": "don_8829"
    }
  }
}
```

#### Response (`200 OK`)
```json
{
  "publish_id": "pub_9a8f2c1d4e07",
  "sent_count": 48
}
```

---

### `POST /beams/{instance_id}/publishes/users`
Publish targeted notifications to specific authenticated user IDs.

#### Request Body
```json
{
  "users": ["usr_1001", "usr_1002"],
  "fcm": {
    "notification": {
      "title": "Your Order is Out for Delivery",
      "body": "Your meal delivery is on the way."
    }
  },
  "apns": {
    "aps": {
      "alert": {
        "title": "Your Order is Out for Delivery",
        "body": "Your meal delivery is on the way."
      }
    }
  }
}
```

#### Response (`200 OK`)
```json
{
  "publish_id": "pub_e419b8417cda",
  "sent_count": 2
}
```

---

### `POST /beams/{instance_id}/users/{user_id}/terminate`
Deletes all registered devices associated with a user ID (useful on account closure or security reset).

#### Response (`200 OK`)
```json
{
  "status": "terminated",
  "user_id": "usr_1001"
}
```

---

## 4. Inspection & Management Endpoints

### `GET /beams/{instance_id}/devices`
List registered devices for the Beams instance.

#### Response (`200 OK`)
```json
[
  {
    "device_id": "fcm-8d2a1bf9c4e20981aef10284",
    "instance_id": "beams_demo_instance",
    "platform": "fcm",
    "token": "dK82n-fcm-device-registration-token-here",
    "user_id": "usr_1001",
    "interests": ["donations"],
    "created_at": "2026-09-09T22:30:00Z",
    "updated_at": "2026-09-09T22:30:00Z"
  }
]
```

---

### `GET /beams/{instance_id}/publishes`
Retrieve push notification publish receipts and history.

#### Response (`200 OK`)
```json
[
  {
    "id": "del_0182",
    "instance_id": "beams_demo_instance",
    "publish_id": "pub_9a8f2c1d4e07",
    "target_type": "interest",
    "target": "donations",
    "platform": "all",
    "sent_count": 48,
    "failed_count": 0,
    "status": "completed",
    "created_at": "2026-09-09T22:31:00Z"
  }
]
```

---

## 5. Provider Credentials Setup

### `PUT /beams/{instance_id}/credentials/fcm`
Upload your Firebase Cloud Messaging Google Service Account JSON. Credentials are encrypted at rest with AES-256-GCM.

```http
PUT /beams/{instance_id}/credentials/fcm
Content-Type: application/json

{
  "service_account_json": "{\n  \"type\": \"service_account\",\n  \"project_id\": \"my-project\"...}"
}
```

### `PUT /beams/{instance_id}/credentials/apns`
Upload Apple Push Notification Service credentials (`.p8` Auth Key).

```http
PUT /beams/{instance_id}/credentials/apns
Content-Type: application/json

{
  "p8_key": "-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEG...\n-----END PRIVATE KEY-----",
  "key_id": "ABCD1234EF",
  "team_id": "TEAMID9988",
  "bundle_id": "com.khajumsanjog.app",
  "production": true
}
```
