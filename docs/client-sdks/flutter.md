# Flutter SDK Guide — APS Channels

Complete integration guide for building real-time Flutter applications for **Android, iOS, Web, and Desktop** with APS using the official `pusher_channels_flutter` plugin.

---

## 📑 Table of Contents
1. [Installation](#1-installation)
2. [Platform Permissions Setup](#2-platform-permissions-setup)
   - [Android Setup](#android-setup)
   - [iOS Setup](#ios-setup)
3. [Initialization & Connection](#3-initialization--connection)
4. [Subscribing to Channels](#4-subscribing-to-channels)
   - [Public Channels](#41-public-channels)
   - [Private Channels & Custom Authorizer](#42-private-channels--custom-authorizer)
   - [Presence Channels (Who's Online)](#43-presence-channels)
5. [Complete Service Class Example](#5-complete-service-class-example)
6. [APS Beams Push Notifications (Firebase FCM)](#6-aps-beams-push-notifications-firebase-fcm)
7. [Troubleshooting & Connection Codes](#7-troubleshooting--connection-codes)

---

## 1. Installation

In your Flutter project's `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  pusher_channels_flutter: ^2.2.1
  http: ^1.2.0 # for private/presence auth calls
```

Run:
```bash
flutter pub get
```

---

## 2. Platform Permissions Setup

### Android Setup
In `android/app/src/main/AndroidManifest.xml`:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    ...
</manifest>
```

> **For local emulator testing (`10.0.2.2:8080`)**: Enable cleartext traffic by adding `android:usesCleartextTraffic="true"` to `<application>` in `AndroidManifest.xml`.

### iOS Setup
In `ios/Runner/Info.plist`:
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>
```

---

## 3. Initialization & Connection

```dart
import 'package:flutter/foundation.dart';
import 'package:pusher_channels_flutter/pusher_channels_flutter.dart';

class RealtimeService {
  static final RealtimeService _instance = RealtimeService._internal();
  factory RealtimeService() => _instance;
  RealtimeService._internal();

  final PusherChannelsFlutter pusher = PusherChannelsFlutter.getInstance();

  Future<void> init() async {
    try {
      await pusher.init(
        apiKey: "aps_key_demo_12345",
        cluster: "mt1",
        host: "aps.khajumsanjog.com", // In local dev: "10.0.2.2" (Android) or "127.0.0.1" (iOS)
        wsPort: 8080,
        wssPort: 443,
        useTLS: true, // false for local dev without SSL
        onConnectionStateChange: (currentState, previousState) {
          debugPrint("APS Connection State: $previousState -> $currentState");
        },
        onError: (message, code, error) {
          debugPrint("APS Error [$code]: $message");
        },
        onSubscriptionSucceeded: (channelName, data) {
          debugPrint("Successfully subscribed to $channelName");
        },
        onEvent: (event) {
          debugPrint("Event Received: ${event.eventName} on channel: ${event.channelName}");
        },
      );

      await pusher.connect();
    } catch (e) {
      debugPrint("Pusher initialization failed: $e");
    }
  }
}
```

---

## 4. Subscribing to Channels

### 4.1 Public Channels

```dart
// Subscribe
await pusher.subscribe(
  channelName: "orders",
  onEvent: (PusherEvent event) {
    debugPrint("Order event data: ${event.data}");
  },
);
```

### 4.2 Private Channels & Custom Authorizer

For channels starting with `private-`, configure the `onAuthorizer` callback to sign the subscription against your backend API:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> initPrivateChannels(String authToken) async {
  await pusher.init(
    apiKey: "aps_key_demo_12345",
    cluster: "mt1",
    host: "aps.khajumsanjog.com",
    wssPort: 443,
    useTLS: true,
    onAuthorizer: (String channelName, String socketId, dynamic options) async {
      final response = await http.post(
        Uri.parse("https://your-api.com/api/broadcasting/auth"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $authToken",
        },
        body: jsonEncode({
          "socket_id": socketId,
          "channel_name": channelName,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception("Auth failed: ${response.statusCode}");
      }
    },
  );

  await pusher.subscribe(channelName: "private-user-991");
  await pusher.connect();
}
```

### 4.3 Presence Channels

Track online users and member actions:

```dart
await pusher.subscribe(
  channelName: "presence-chat-room",
  onMemberAdded: (member) {
    debugPrint("User joined: ${member.userId} - ${member.userInfo}");
  },
  onMemberRemoved: (member) {
    debugPrint("User left: ${member.userId}");
  },
  onEvent: (event) {
    if (event.eventName == "chat_message") {
      debugPrint("Message: ${event.data}");
    }
  },
);
```

---

## 5. Complete Service Class Example

Here is a full Flutter service class that you can drop into your project:

```dart
import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:pusher_channels_flutter/pusher_channels_flutter.dart';

class ApsClient {
  final PusherChannelsFlutter _pusher = PusherChannelsFlutter.getInstance();
  final _eventController = StreamController<PusherEvent>.broadcast();

  Stream<PusherEvent> get eventStream => _eventController.stream;

  Future<void> initialize({
    required String appKey,
    required String host,
    int port = 443,
    bool useTLS = true,
  }) async {
    await _pusher.init(
      apiKey: appKey,
      cluster: "mt1",
      host: host,
      wsPort: port,
      wssPort: port,
      useTLS: useTLS,
      onEvent: (event) {
        _eventController.add(event);
      },
      onConnectionStateChange: (current, previous) {
        debugPrint("APS: $previous -> $current");
      },
      onError: (msg, code, err) {
        debugPrint("APS Error ($code): $msg");
      },
    );

    await _pusher.connect();
  }

  Future<void> subscribe(String channel) async {
    await _pusher.subscribe(channelName: channel);
  }

  Future<void> unsubscribe(String channel) async {
    await _pusher.unsubscribe(channelName: channel);
  }

  Future<void> disconnect() async {
    await _pusher.disconnect();
    await _eventController.close();
  }
}
```

---

## 6. APS Beams Push Notifications (Firebase FCM)

To register your Flutter app with APS Beams for background push notifications:

1. Add `firebase_core` and `firebase_messaging` to your Flutter app.
2. After initializing Firebase, retrieve the token and send it to APS Beams:

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<void> registerWithApsBeams(List<String> interests) async {
  final fcmToken = await FirebaseMessaging.instance.getToken();
  if (fcmToken == null) return;

  final response = await http.post(
    Uri.parse("https://aps.khajumsanjog.com/beams/beams_demo_instance/devices/fcm/register"),
    headers: {"Content-Type": "application/json"},
    body: jsonEncode({
      "token": fcmToken,
      "interests": interests,
    }),
  );

  if (response.statusCode == 200 || response.statusCode == 201) {
    debugPrint("Registered device with APS Beams successfully!");
  }
}
```

---

## 7. Troubleshooting & Connection Codes

| Code | Meaning | Solution |
| :--- | :--- | :--- |
| `4001` | App key does not exist | Check that your `apiKey` matches the App Key in Developer Console |
| `4004` | App is disabled | Enable the app from the APS Dashboard |
| `4009` | Connection timeout / Ping failed | Ensure your firewall allows outbound WebSockets (ports 80, 443, 8080) |
| `Handshake Error` | Cleartext traffic rejected | Enable `usesCleartextTraffic="true"` on Android or use TLS (`wss://`) |
