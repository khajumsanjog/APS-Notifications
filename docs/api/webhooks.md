# Webhooks & Dead-Letter Replay Reference

APS supports HTTP POST webhook callbacks dispatched whenever channel events occur in your application cluster. Webhooks follow the official **Pusher Webhooks Specification** with HMAC-SHA256 signature verification headers.

---

## 1. Webhook Event Types

APS can send callbacks for the following 5 events:

| Event Type | Trigger Condition |
| :--- | :--- |
| `channel_occupied` | Triggered when the first client subscribes to an empty channel. |
| `channel_vacated` | Triggered when the last subscriber unsubscribes or disconnects from a channel. |
| `member_added` | Triggered when a new user subscribes to a `presence-*` channel. |
| `member_removed` | Triggered when a user leaves or disconnects from a `presence-*` channel. |
| `client_event` | Triggered when a client dispatches a `client-*` event over a private/presence channel. |

---

## 2. Webhook HTTP Payload Format

APS dispatches an HTTP POST request to your registered webhook URL with the following JSON payload:

```json
{
  "time_ms": 1788972000123,
  "events": [
    {
      "name": "channel_occupied",
      "channel": "presence-chat-room"
    },
    {
      "name": "member_added",
      "channel": "presence-chat-room",
      "user_id": "usr_1001"
    }
  ]
}
```

---

## 3. Verifying Webhook Signatures

Every webhook POST includes security headers to prevent spoofing:

| Header | Description |
| :--- | :--- |
| `X-Pusher-Key` | The application key (`app_key`) that generated the webhook. |
| `X-Pusher-Signature` | The HMAC-SHA256 signature computed over the raw HTTP request body using the application's `app_secret`. |

### Signature Verification Examples

#### Node.js (Express)
```javascript
const crypto = require('crypto');

function verifyWebhook(req, res, next) {
  const webhookSignature = req.headers['x-pusher-signature'];
  const appSecret = process.env.APS_APP_SECRET;

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody) // must be raw buffer or string
    .digest('hex');

  if (webhookSignature !== expectedSignature) {
    return res.status(401).send('Invalid webhook signature');
  }
  next();
}
```

#### Go (Chi / Standard Library)
```go
func verifyWebhook(appSecret string, body []byte, signature string) bool {
    mac := hmac.New(sha256.New, []byte(appSecret))
    mac.Write(body)
    expected := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expected), []byte(signature))
}
```

#### Python (Flask / FastAPI)
```python
import hmac
import hashlib

def verify_webhook(raw_body: bytes, signature: str, app_secret: str) -> bool:
    expected = hmac.new(app_secret.encode('utf-8'), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

---

## 4. Webhook Management API

Manage webhook endpoints via the Developer Console REST API.

### `GET /api/apps/{id}/webhooks`
List configured webhook endpoints for an app.

#### Response (`200 OK`)
```json
[
  {
    "id": "83f669d2-be0f-46bf-9ff0-c9e0e025e7e6",
    "app_id": "100001",
    "url": "https://myserver.com/webhooks/aps",
    "events": ["channel_occupied", "channel_vacated", "member_added", "member_removed"],
    "active": true,
    "created_at": "2026-09-09T22:30:00Z"
  }
]
```

---

### `POST /api/apps/{id}/webhooks`
Register a new webhook endpoint.

#### Request Body
```json
{
  "url": "https://myserver.com/webhooks/aps",
  "events": ["channel_occupied", "channel_vacated", "member_added", "member_removed", "client_event"]
}
```

#### Response (`201 Created`)
```json
{
  "id": "83f669d2-be0f-46bf-9ff0-c9e0e025e7e6",
  "app_id": "100001",
  "url": "https://myserver.com/webhooks/aps",
  "events": ["channel_occupied", "channel_vacated", "member_added", "member_removed", "client_event"],
  "active": true,
  "created_at": "2026-09-09T22:30:00Z"
}
```

---

### `DELETE /api/apps/{id}/webhooks/{webhook_id}`
Delete a webhook endpoint.

#### Response (`204 No Content`)

---

## 5. Dead-Letter Queue & Delivery Logs

### `GET /api/apps/{id}/webhooks/deliveries`
Returns the recent execution log of webhook delivery attempts, including HTTP status codes, latencies, and error messages.

#### Response (`200 OK`)
```json
[
  {
    "id": "deliv_9182",
    "webhook_id": "83f669d2-be0f-46bf-9ff0-c9e0e025e7e6",
    "app_id": "100001",
    "event": "member_added",
    "status_code": 200,
    "response_body": "{\"status\":\"ok\"}",
    "attempt": 1,
    "status": "success",
    "error": "",
    "created_at": "2026-09-09T22:31:00Z",
    "updated_at": "2026-09-09T22:31:00Z"
  }
]
```

### Retry Policy
If your webhook destination server returns a non-2xx status code or times out:
1. APS automatically schedules retries with exponential backoff (up to 3 attempts).
2. Failures are recorded with the HTTP error status in the deliveries log for dead-letter analysis.
