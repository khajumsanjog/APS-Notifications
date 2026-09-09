# Developer Console Control Plane API Reference

The APS Developer Console REST API powers the Next.js 16 dashboard and allows developers to programmatically create applications, manage API keys, inspect cluster health, configure webhooks, and query metrics.

Base URL: `http://localhost:8080/api` (or `https://aps.khajumsanjog.com/api`)

---

## 1. Authentication Endpoints

### `POST /api/auth/register`
Create a new developer console account.

#### Request Body
```json
{
  "email": "developer@khajumsanjog.com",
  "password": "password123"
}
```

#### Response (`201 Created`)
```json
{
  "user": {
    "id": "usr_94a812ef",
    "email": "developer@khajumsanjog.com",
    "role": "developer",
    "created_at": "2026-09-09T22:30:00Z"
  }
}
```

---

### `POST /api/auth/login`
Authenticate with email and password to receive a JWT session token.

#### Request Body
```json
{
  "email": "developer@khajumsanjog.com",
  "password": "password123"
}
```

#### Response (`200 OK`)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_94a812ef",
    "email": "developer@khajumsanjog.com",
    "role": "admin"
  }
}
```
*Note: Pass this token as an HTTP header on subsequent requests: `Authorization: Bearer <token>`.*

---

### `GET /api/auth/me`
Verify the current active session and retrieve user profile details.

#### Headers
```http
Authorization: Bearer <token>
```

#### Response (`200 OK`)
```json
{
  "user": {
    "id": "usr_94a812ef",
    "email": "developer@khajumsanjog.com",
    "role": "admin"
  }
}
```

---

## 2. Application Management Endpoints

All application routes require `Authorization: Bearer <token>`.

### `GET /api/apps`
List all applications owned by the authenticated developer.

#### Response (`200 OK`)
```json
[
  {
    "id": "100001",
    "name": "Khajum Sanjog Realtime",
    "app_key": "aps_key_demo_12345",
    "app_secret": "aps_secret_demo_67890",
    "owner_id": "usr_94a812ef",
    "cluster": "mt1",
    "rate_limit_rps": 1000,
    "max_connections": 10000,
    "message_history_enabled": true,
    "webhooks_enabled": true,
    "created_at": "2026-09-09T22:30:00Z",
    "updated_at": "2026-09-09T22:30:00Z"
  }
]
```

---

### `POST /api/apps`
Create a new real-time application. Automatically provisions an `app_key`, `app_secret`, and linked `beams_instance`.

#### Request Body
```json
{
  "name": "E-Commerce Realtime",
  "cluster": "mt1"
}
```

#### Response (`201 Created`)
```json
{
  "id": "100002",
  "name": "E-Commerce Realtime",
  "app_key": "aps_key_8f1a92",
  "app_secret": "aps_sec_e4b109",
  "cluster": "mt1",
  "created_at": "2026-09-09T22:35:00Z"
}
```

---

### `GET /api/apps/{id}`
Retrieve application details including its associated Beams push configuration.

#### Response (`200 OK`)
```json
{
  "app": {
    "id": "100001",
    "name": "Khajum Sanjog Realtime",
    "app_key": "aps_key_demo_12345",
    "app_secret": "aps_secret_demo_67890",
    "cluster": "mt1",
    "rate_limit_rps": 1000,
    "max_connections": 10000,
    "message_history_enabled": true,
    "webhooks_enabled": true
  },
  "beams_instance": {
    "instance_id": "beams_demo_instance",
    "app_id": "100001",
    "has_fcm": true,
    "has_apns": false
  }
}
```

---

### `PUT /api/apps/{id}`
Update application configuration, rate limits, or features.

#### Request Body
```json
{
  "name": "Updated App Name",
  "rate_limit_rps": 2500,
  "max_connections": 50000,
  "message_history_enabled": true,
  "webhooks_enabled": true
}
```

#### Response (`200 OK`)
```json
{
  "status": "updated"
}
```

---

### `DELETE /api/apps/{id}`
Delete an application and revoke all associated keys and credentials.

#### Response (`204 No Content`)

---

## 3. Real-Time Metrics & Statistics

### `GET /api/apps/{id}/stats`
Inspect real-time socket counts, presence room counts, and cluster state.

#### Response (`200 OK`)
```json
{
  "active_connections": 142,
  "occupied_channels": 8,
  "presence_users": 64,
  "cluster": "mt1",
  "timestamp": "2026-09-09T22:40:00Z"
}
```

---

## 4. API Keys Management

### `GET /api/apps/{id}/keys`
List active API keys for an application.

#### Response (`200 OK`)
```json
[
  {
    "id": "key_01",
    "app_id": "100001",
    "key": "aps_key_demo_12345",
    "secret": "aps_secret_demo_67890",
    "created_at": "2026-09-09T22:30:00Z"
  }
]
```

### `POST /api/apps/{id}/keys`
Generate a new pair of credentials (useful for key rotation).

#### Response (`201 Created`)
```json
{
  "id": "key_02",
  "app_id": "100001",
  "key": "aps_key_new_77810",
  "secret": "aps_sec_new_19283",
  "created_at": "2026-09-09T22:42:00Z"
}
```

### `DELETE /api/apps/{id}/keys/{key_id}`
Revoke an API key.

#### Response (`204 No Content`)
