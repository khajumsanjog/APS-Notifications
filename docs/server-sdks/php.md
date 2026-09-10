# PHP & Laravel Broadcasting Guide — APS Channels

Complete server-side integration guide for triggering real-time events, authorizing private channels, and validating webhooks in **PHP, Laravel, Symfony, and CodeIgniter** (including **cPanel Shared Hosting** environments).

---

## 📑 Table of Contents
1. [Installation](#1-installation)
2. [Native PHP Integration](#2-native-php-integration)
   - [Basic Event Trigger](#21-basic-event-trigger)
   - [Batch Events & Channel Queries](#22-batch-events--channel-queries)
   - [Private & Presence Channel Auth Endpoint in Raw PHP](#23-private--presence-channel-auth-endpoint-in-raw-php)
3. [Laravel Native Broadcasting](#3-laravel-native-broadcasting)
   - [Environment Configuration (`.env`)](#31-environment-configuration-env)
   - [Broadcasting Driver Configuration (`broadcasting.php`)](#32-broadcasting-driver-configuration-broadcastingphp)
   - [Creating & Dispatching Broadcast Events](#33-creating--dispatching-broadcast-events)
   - [Channel Authorization Routes (`routes/channels.php`)](#34-channel-authorization-routes-routeschannelsphp)
4. [Publishing from cPanel Shared Hosting](#4-publishing-from-cpanel-shared-hosting)
5. [Webhook Verification in PHP](#5-webhook-verification-in-php)
6. [APS Beams Mobile Push via PHP](#6-aps-beams-mobile-push-via-php)

---

## 1. Installation

Install the official Pusher PHP server SDK via Composer:

```bash
composer require pusher/pusher-php-server
```

---

## 2. Native PHP Integration

### 2.1 Basic Event Trigger

```php
<?php
require __DIR__ . '/vendor/autoload.php';

use Pusher\Pusher;

$app_id = '100001';
$app_key = 'aps_key_demo_12345';
$app_secret = 'aps_secret_demo_67890';

$options = [
    'cluster' => 'mt1',
    'host' => 'aps.khajumsanjog.com', // In local dev: 'localhost'
    'port' => 443,                     // In local dev: 8080
    'scheme' => 'https',               // In local dev: 'http'
    'useTLS' => true                   // In local dev: false
];

$pusher = new Pusher($app_key, $app_secret, $app_id, $options);

// Broadcast an event to one or more channels:
$data = [
    'order_id' => 1001,
    'status' => 'Dispatched',
    'timestamp' => time()
];

$pusher->trigger('orders', 'order_status_updated', $data);

echo "Real-time event sent successfully!";
```

### 2.2 Batch Events & Channel Queries

```php
// Trigger batch events:
$batch = [
    ['channel' => 'orders', 'name' => 'status', 'data' => ['id' => 101, 'state' => 'delivered']],
    ['channel' => 'notifications', 'name' => 'alert', 'data' => ['msg' => 'Driver arriving']],
];
$pusher->triggerBatch($batch);

// Query occupied channels:
$channels = $pusher->getChannels();
print_r($channels);

// Query presence channel users:
$users = $pusher->getPresenceUsers('presence-chat-room');
print_r($users);
```

### 2.3 Private & Presence Channel Auth Endpoint in Raw PHP

Create `auth.php` for clients authenticating private/presence channels:

```php
<?php
require __DIR__ . '/vendor/autoload.php';

use Pusher\Pusher;

header('Content-Type: application/json');

// 1. Verify user session / cookie:
session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$socket_id = $_POST['socket_id'];
$channel_name = $_POST['channel_name'];

$pusher = new Pusher('aps_key_demo_12345', 'aps_secret_demo_67890', '100001', [
    'host' => 'aps.khajumsanjog.com',
    'port' => 443,
    'scheme' => 'https',
    'useTLS' => true,
]);

// Presence Channel
if (strpos($channel_name, 'presence-') === 0) {
    $presence_data = [
        'name' => $_SESSION['user_name'],
        'role' => $_SESSION['user_role'],
    ];
    echo $pusher->authorizePresenceChannel($channel_name, $socket_id, $_SESSION['user_id'], $presence_data);
    exit;
}

// Private Channel
echo $pusher->authorizeChannel($channel_name, $socket_id);
```

---

## 3. Laravel Native Broadcasting

Because APS implements the standard Pusher HTTP protocol, Laravel's built-in `pusher` broadcast driver works natively **without installing any custom packages**.

### 3.1 Environment Configuration (`.env`)

```env
BROADCAST_CONNECTION=pusher

PUSHER_APP_ID=100001
PUSHER_APP_KEY=aps_key_demo_12345
PUSHER_APP_SECRET=aps_secret_demo_67890
PUSHER_HOST=aps.khajumsanjog.com
PUSHER_PORT=443
PUSHER_SCHEME=https
PUSHER_APP_CLUSTER=mt1
```

### 3.2 Broadcasting Driver Configuration (`config/broadcasting.php`)

```php
'pusher' => [
    'driver' => 'pusher',
    'key' => env('PUSHER_APP_KEY'),
    'secret' => env('PUSHER_APP_SECRET'),
    'app_id' => env('PUSHER_APP_ID'),
    'options' => [
        'cluster' => env('PUSHER_APP_CLUSTER'),
        'host' => env('PUSHER_HOST'),
        'port' => env('PUSHER_PORT', 443),
        'scheme' => env('PUSHER_SCHEME', 'https'),
        'encrypted' => true,
        'useTLS' => env('PUSHER_SCHEME', 'https') === 'https',
    ],
],
```

### 3.3 Creating & Dispatching Broadcast Events

```php
namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Queue\SerializesModels;

class OrderStatusChanged implements ShouldBroadcast
{
    use InteractsWithSockets, SerializesModels;

    public $order;

    public function __construct($order)
    {
        $this->order = $order;
    }

    public function broadcastOn()
    {
        return new Channel('orders');
    }

    public function broadcastAs()
    {
        return 'order_status_updated';
    }
}
```

Triggering in your controller:
```php
event(new OrderStatusChanged($order));
```

### 3.4 Channel Authorization Routes (`routes/channels.php`)

Laravel automatically manages channel authorization endpoints via `Broadcast::routes()`:

```php
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('orders.{orderId}', function ($user, $orderId) {
    return (int) $user->id === (int) Order::find($orderId)->user_id;
});

Broadcast::channel('chat.{roomId}', function ($user, $roomId) {
    return ['id' => $user->id, 'name' => $user->name];
});
```

---

## 4. Publishing from cPanel Shared Hosting

A common question is: **"Can my cPanel shared hosting run APS?"**

### The Answer & Architecture:
- **Shared cPanel servers cannot host WebSocket daemons**: Shared hosting environments kill long-running background processes (like Go or Node daemons) and block custom WebSocket ports.
- **HOWEVER, your PHP website on cPanel CAN publish to APS seamlessly!**
  - Host your PHP website on cPanel as usual.
  - Run the APS server daemon on a lightweight VPS (like AWS EC2 `t4g.micro` or any $4/month server).
  - When a user performs an action on your cPanel website, PHP makes a standard outbound HTTPS `POST` request to `https://aps.yourdomain.com`.
  - Your users' browsers and mobile apps connect directly to APS over WebSockets.
  - **No root access or special permissions required on your cPanel account!**

---

## 5. Webhook Verification in PHP

APS signs all webhooks with your App Secret. Verify incoming webhooks safely:

```php
<?php
$app_secret = 'aps_secret_demo_67890';
$signature = $_SERVER['HTTP_X_PUSHER_SIGNATURE'] ?? '';
$payload = file_get_contents('php://input');

$expected_signature = hash_hmac('sha256', $payload, $app_secret);

if (!hash_equals($expected_signature, $signature)) {
    http_response_code(401);
    die('Invalid signature');
}

$data = json_decode($payload, true);
foreach ($data['events'] as $event) {
    error_log("APS Webhook: {$event['name']} on {$event['channel']}");
}

http_response_code(200);
echo 'OK';
```

---

## 6. APS Beams Mobile Push via PHP

Send mobile push notifications using native PHP cURL:

```php
<?php
function sendApsBeamsPush($interest, $title, $body) {
    $instance_id = 'beams_demo_instance';
    $secret_key = 'aps_beams_secret_123';

    $url = "https://aps.khajumsanjog.com/beams/{$instance_id}/publishes/interests";
    
    $payload = [
        'interests' => [$interest],
        'fcm' => [
            'notification' => [
                'title' => $title,
                'body' => $body
            ]
        ],
        'apns' => [
            'aps' => [
                'alert' => [
                    'title' => $title,
                    'body' => $body
                ],
                'sound' => 'default'
            ]
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $secret_key
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ($httpCode >= 200 && $httpCode < 300);
}
```
