# Android Developer Guide — APS Channels & Beams

Comprehensive guide for integrating real-time WebSockets (**APS Channels**) and mobile push notifications (**APS Beams**) into Android applications using Kotlin and Java.

APS is 100% protocol-compatible with Pusher Channels. You use the standard, official `pusher-java-client` library without any custom or proprietary SDK dependencies.

---

## 📑 Table of Contents
1. [Prerequisites & API Keys](#1-prerequisites--api-keys)
2. [Installation & Permissions](#2-installation--permissions)
3. [Network Security Configuration (Cleartext & Local Testing)](#3-network-security-configuration)
4. [Connecting to APS](#4-connecting-to-aps)
5. [Working with Channels](#5-working-with-channels)
   - [Public Channels](#51-public-channels)
   - [Private Channels (Authentication)](#52-private-channels)
   - [Presence Channels (Who is Online)](#53-presence-channels)
   - [Client Events (Peer-to-Peer)](#54-client-events)
6. [Complete Activity Example (`MainActivity.kt`)](#6-complete-activity-example)
7. [APS Beams: Mobile Push Notifications (FCM)](#7-aps-beams-mobile-push-notifications)
   - [Firebase Setup](#71-firebase-setup)
   - [Register Device Token with APS](#72-register-device-token-with-aps)
   - [Notification Handler (`MyFirebaseMessagingService.kt`)](#73-notification-handler)
8. [Connection Lifecycle & Reconnection](#8-connection-lifecycle--reconnection)
9. [ProGuard / R8 Rules](#9-proguard--r8-rules)
10. [Error Codes & Troubleshooting](#10-error-codes--troubleshooting)

---

## 1. Prerequisites & API Keys

Before writing code, grab your credentials from the APS Developer Console (`http://localhost:3000` or your production domain):

| Parameter | Example Value | Description |
| :--- | :--- | :--- |
| **App ID** | `100001` | Unique application tenant identifier |
| **App Key** | `aps_key_demo_12345` | Public key safe to embed in your Android APK |
| **Cluster** | `mt1` | Cluster region code |
| **Host** | `aps.khajumsanjog.com` | Hostname of your APS server |
| **Port** | `443` (TLS) / `8080` (Plain) | WebSocket port |
| **Beams Instance ID** | `beams_demo_instance` | Instance ID for mobile push notifications |

---

## 2. Installation & Permissions

### Step 2.1: AndroidManifest.xml
Add required permissions in `app/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.apsdemo">

    <!-- Mandatory permissions for WebSockets & Push -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <!-- Android 13+ (API 33+) push notification permission -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:networkSecurityConfig="@xml/network_security_config"
        android:theme="@style/Theme.APSDemo">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Push notification background handler -->
        <service
            android:name=".MyFirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

    </application>
</manifest>
```

### Step 2.2: Dependencies (`build.gradle.kts` / `build.gradle`)

#### Kotlin DSL (`build.gradle.kts`):
```kotlin
dependencies {
    // Official Pusher WebSocket client (Pusher Protocol v7)
    implementation("com.pusher:pusher-java-client:2.4.4")

    // Firebase Cloud Messaging (for APS Beams push notifications)
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")

    // JSON parsing & HTTP client for background token registration
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
```

#### Groovy DSL (`build.gradle`):
```groovy
dependencies {
    implementation 'com.pusher:pusher-java-client:2.4.4'
    implementation platform('com.google.firebase:firebase-bom:33.7.0')
    implementation 'com.google.firebase:firebase-messaging'
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
}
```

---

## 3. Network Security Configuration

Android 9+ (API 28+) strictly forbids cleartext `http://` and `ws://` traffic unless explicitly configured.

Create `app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Allow cleartext traffic for local development & emulators -->
    <domain-config cleartextTrafficPermitted="true">
        <!-- 10.0.2.2 is the official Android Emulator loopback to host PC -->
        <domain includeSubdomains="true">10.0.2.2</domain>
        <!-- Genymotion emulator loopback -->
        <domain includeSubdomains="true">10.0.3.2</domain>
        <!-- Local machine LAN IP -->
        <domain includeSubdomains="true">192.168.1.192</domain>
        <domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>
```

---

## 4. Connecting to APS

### Kotlin
```kotlin
import com.pusher.client.Pusher
import com.pusher.client.PusherOptions
import com.pusher.client.connection.ConnectionEventListener
import com.pusher.client.connection.ConnectionState
import com.pusher.client.connection.ConnectionStateChange
import android.util.Log

class RealtimeClient(private val appKey: String) {
    private var pusher: Pusher? = null

    fun connect(isProduction: Boolean = false) {
        val options = PusherOptions().apply {
            setCluster("mt1")
            
            if (isProduction) {
                // Production TLS (WSS port 443)
                setHost("aps.khajumsanjog.com")
                setWssPort(443)
                isUseTLS = true
            } else {
                // Local testing on Android Emulator (WS port 8080)
                setHost("10.0.2.2")
                setWsPort(8080)
                isUseTLS = false
            }
        }

        pusher = Pusher(appKey, options)

        pusher?.connect(object : ConnectionEventListener {
            override fun onConnectionStateChange(change: ConnectionStateChange) {
                Log.i("APS", "State: ${change.previousState} -> ${change.currentState}")
            }

            override fun onError(message: String?, code: String?, e: Exception?) {
                Log.e("APS", "Error: $message, code: $code", e)
            }
        }, ConnectionState.ALL)
    }

    fun getPusher(): Pusher = pusher ?: throw IllegalStateException("Call connect() first")

    fun disconnect() {
        pusher?.disconnect()
    }
}
```

---

## 5. Working with Channels

### 5.1 Public Channels
No authentication required. Ideal for public broadcast feeds, live order status, sports scores, and chat rooms.

```kotlin
val pusher = realtimeClient.getPusher()
val channel = pusher.subscribe("orders")

// Bind to event
channel.bind("order_updated") { event ->
    // event.data is the JSON string emitted from your server
    Log.d("APS", "Received: ${event.data}")
}
```

### 5.2 Private Channels
Prefixed with `private-`. Requires your backend server to verify the user's session before allowing access.

```kotlin
import com.pusher.client.util.HttpAuthorizer

// 1. Point to your backend authentication endpoint
val authorizer = HttpAuthorizer("https://api.yourdomain.com/broadcasting/auth").apply {
    setHeaders(mapOf("Authorization" to "Bearer USER_JWT_TOKEN"))
}

val options = PusherOptions().apply {
    setAuthorizer(authorizer)
    setHost("aps.khajumsanjog.com")
    setWssPort(443)
    isUseTLS = true
}

val pusher = Pusher("YOUR_APP_KEY", options)
pusher.connect()

// 2. Subscribe to private channel
val privateChannel = pusher.subscribePrivate("private-user-1001")
privateChannel.bind("account_alert") { event ->
    Log.d("APS", "Private alert: ${event.data}")
}
```

### 5.3 Presence Channels
Prefixed with `presence-`. Tracks online users and notifies when members join or leave.

```kotlin
import com.pusher.client.channel.PresenceChannelEventListener
import com.pusher.client.channel.PusherEvent
import com.pusher.client.channel.User

val presenceChannel = pusher.subscribePresence("presence-meeting-room", object : PresenceChannelEventListener {
    override fun onUsersInformationReceived(channelName: String, users: Set<User>) {
        Log.d("APS", "Currently online: ${users.size} users")
        users.forEach { user -> Log.d("APS", "User: ${user.id} -> ${user.info}") }
    }

    override fun userSubscribed(channelName: String, user: User) {
        Log.d("APS", "User joined: ${user.id}")
    }

    override fun userUnsubscribed(channelName: String, user: User) {
        Log.d("APS", "User left: ${user.id}")
    }

    override fun onAuthenticationFailure(message: String, e: Exception) {
        Log.e("APS", "Auth failure: $message")
    }

    override fun onSubscriptionSucceeded(channelName: String) {
        Log.d("APS", "Successfully joined presence channel")
    }

    override fun onEvent(event: PusherEvent) {
        Log.d("APS", "Received event in presence room: ${event.data}")
    }
})
```

### 5.4 Client Events (Peer-to-Peer)
Allowed on `private-*` and `presence-*` channels. Trigger an event directly from one client to other subscribers without sending an HTTP request to your backend:

```kotlin
// Trigger client event (must begin with 'client-')
privateChannel.trigger("client-typing", "{\"user\": \"John\", \"typing\": true}")
```

---

## 6. Complete Activity Example

A complete, working `MainActivity.kt` showing connection, subscribing, UI updates, and clean lifecycle teardown:

```kotlin
package com.example.apsdemo

import android.os.Bundle
import android.util.Log
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.pusher.client.Pusher
import com.pusher.client.PusherOptions
import com.pusher.client.channel.Channel
import com.pusher.client.connection.ConnectionEventListener
import com.pusher.client.connection.ConnectionState
import com.pusher.client.connection.ConnectionStateChange
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var pusher: Pusher
    private lateinit var statusText: TextView
    private lateinit var messageText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        messageText = findViewById(R.id.messageText)

        initApsConnection()
    }

    private fun initApsConnection() {
        val options = PusherOptions().apply {
            setCluster("mt1")
            
            // Testing on Android Emulator:
            setHost("10.0.2.2")
            setWsPort(8080)
            isUseTLS = false

            // Production:
            // setHost("aps.khajumsanjog.com")
            // setWssPort(443)
            // isUseTLS = true
        }

        pusher = Pusher("aps_key_demo_12345", options)

        // Connection State Listener
        pusher.connect(object : ConnectionEventListener {
            override fun onConnectionStateChange(change: ConnectionStateChange) {
                runOnUiThread {
                    statusText.text = "Connection: ${change.currentState}"
                }
            }

            override fun onError(message: String?, code: String?, e: Exception?) {
                Log.e("APS", "Error: $message")
            }
        }, ConnectionState.ALL)

        // Subscribe to Orders Channel
        val channel: Channel = pusher.subscribe("orders")
        channel.bind("order_status_updated") { event ->
            try {
                val json = JSONObject(event.data)
                val status = json.optString("status", "Unknown")

                runOnUiThread {
                    messageText.text = "Latest Update: $status"
                }
            } catch (e: Exception) {
                Log.e("APS", "JSON parse error", e)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::pusher.isInitialized) {
            pusher.unsubscribe("orders")
            pusher.disconnect()
        }
    }
}
```

---

## 7. APS Beams: Mobile Push Notifications

When your user locks their phone or closes the app, WebSockets disconnect. **APS Beams** delivers native lock-screen push notifications via **Firebase Cloud Messaging (FCM)**.

### 7.1 Firebase Setup
1. Add `google-services.json` to your `app/` folder.
2. In the APS Console (`http://localhost:3000/dashboard/apps/{app_id}/beams`), upload your Firebase Service Account JSON so APS can dispatch FCM notifications.

### 7.2 Register Device Token with APS
When Firebase generates or refreshes a device token, register it with APS Beams:

```kotlin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

fun registerDeviceWithAps(
    instanceId: String,
    deviceToken: String,
    interests: List<String>,
    userId: String? = null
) {
    val client = OkHttpClient()
    val url = "https://aps.khajumsanjog.com/beams/$instanceId/devices/fcm/register"

    val payload = JSONObject().apply {
        put("token", deviceToken)
        put("interests", JSONArray(interests))
        if (userId != null) put("user_id", userId)
    }

    val body = payload.toString().toRequestBody("application/json".toMediaType())
    val request = Request.Builder().url(url).post(body).build()

    client.newCall(request).enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
            Log.e("APS_BEAMS", "Device registration failed", e)
        }

        override fun onResponse(call: Call, response: Response) {
            Log.i("APS_BEAMS", "Device registered: ${response.code}")
        }
    })
}
```

### 7.3 Notification Handler (`MyFirebaseMessagingService.kt`)
Receives background push notifications from APS Beams:

```kotlin
package com.example.apsdemo

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("APS_BEAMS", "New FCM Token: $token")

        // Register device with APS Beams:
        registerDeviceWithAps(
            instanceId = "beams_demo_instance",
            deviceToken = token,
            interests = listOf("announcements", "orders"),
            userId = "user_1001"
        )
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val title = message.notification?.title ?: message.data["title"] ?: "New Notification"
        val body = message.notification?.body ?: message.data["body"] ?: "You have a new update."

        showNotification(title, body)
    }

    private fun showNotification(title: String, body: String) {
        val channelId = "aps_channel_default"
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "APS Notifications",
                NotificationManager.IMPORTANCE_HIGH
            )
            manager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        manager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
```

---

## 8. Connection Lifecycle & Reconnection

The `pusher-java-client` automatically handles reconnecting when network connectivity changes (e.g., switching from Wi-Fi to 4G/5G).

APS sends WebSocket heartbeat ping/pong frames every 30 seconds to maintain connection health.

### Manual Reconnect
```kotlin
if (pusher.connection.state == ConnectionState.DISCONNECTED) {
    pusher.connect()
}
```

---

## 9. ProGuard / R8 Rules

If you enable code shrinking in release builds (`minifyEnabled = true`), add these rules to `app/proguard-rules.pro`:

```proguard
# Pusher Java Client
-keep class com.pusher.client.** { *; }
-dontwarn com.pusher.client.**

# WebSocket support
-keep class org.java_websocket.** { *; }
-dontwarn org.java_websocket.**

# GSON / JSON Models
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
```

---

## 10. Error Codes & Troubleshooting

| Code | Meaning | Fix |
| :--- | :--- | :--- |
| **`4001`** | App key not found | Verify your `app_key` in the APS Console |
| **`4004`** | App disabled / suspended | Enable your application in the console |
| **`4100`** | Over connection limit | Check your server RAM and connection limits |
| **`4200`** | Connection closed generic | Connection dropped; client auto-reconnects |
| **Cleartext HTTP Error** | `CLEARTEXT communication to 10.0.2.2 not permitted` | Add `network_security_config.xml` (Section 3) |
| **Timeout connecting** | Cannot connect to `10.0.2.2:8080` | Ensure APS is running (`./aps status` or `docker ps`) |
