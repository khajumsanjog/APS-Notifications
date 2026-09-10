# iOS Swift SDK Guide — APS Channels

Complete integration guide for building real-time iOS applications with APS using the official `PusherSwift` library.

Supports **iOS 13.0+, iPadOS, macOS, and Mac Catalyst** with Swift 5.5+.

---

## 📑 Table of Contents
1. [Installation](#1-installation)
   - [Swift Package Manager (Recommended)](#swift-package-manager-recommended)
   - [CocoaPods](#cocoapods)
2. [Initialization & Connection](#2-initialization--connection)
3. [Subscribing to Channels](#3-subscribing-to-channels)
   - [Public Channels](#31-public-channels)
   - [Private Channels & Authentication](#32-private-channels--authentication)
   - [Presence Channels (Who's Online)](#33-presence-channels)
4. [Handling Connection Lifecycle & Reconnection](#4-handling-connection-lifecycle--reconnection)
5. [Local Testing on iOS Simulator](#5-local-testing-on-ios-simulator)
6. [APS Beams (Push Notifications for iOS via APNs)](#6-aps-beams-push-notifications-for-ios-via-apns)
7. [Production Hardening](#7-production-hardening)

---

## 1. Installation

### Swift Package Manager (Recommended)
1. In Xcode, select **File** → **Add Packages...**
2. In the search box, paste:
   ```
   https://github.com/pusher/pusher-websocket-swift
   ```
3. Set Dependency Rule to **Up to Next Major Version** starting from `10.1.0`.
4. Add to your application target.

### CocoaPods
Add the following to your `Podfile`:
```ruby
pod 'PusherSwift', '~> 10.1.0'
```
Then run:
```bash
pod install
```

---

## 2. Initialization & Connection

Create a shared real-time manager or inject it into your view models:

```swift
import UIKit
import PusherSwift

class RealtimeManager: PusherDelegate {
    static let shared = RealtimeManager()
    
    var pusher: Pusher!
    
    private init() {
        let options = PusherClientOptions(
            host: .host("aps.khajumsanjog.com"), // Production domain or VPS IP
            port: 443,
            useTLS: true,
            cluster: "mt1"
        )
        
        pusher = Pusher(key: "aps_key_demo_12345", options: options)
        pusher.delegate = self
    }
    
    func connect() {
        pusher.connect()
    }
    
    func disconnect() {
        pusher.disconnect()
    }
}
```

---

## 3. Subscribing to Channels

### 3.1 Public Channels

Public channels require no authentication and can be subscribed to immediately:

```swift
// Subscribe to 'announcements'
let channel = pusher.subscribe("announcements")

// Bind to event
let _ = channel.bind(eventName: "breaking_news") { (event: PusherEvent) in
    guard let jsonString = event.data else { return }
    print("Received real-time event: \(jsonString)")
    
    // Parse JSON data
    if let data = jsonString.data(using: .utf8),
       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        DispatchQueue.main.async {
            // Update your UI on main thread
            print("Title: \(json["title"] ?? "")")
        }
    }
}
```

### 3.2 Private Channels & Authentication

Private channels (`private-*`) require authorization from your backend server:

```swift
// 1. Configure Auth Endpoint
let authOptions = PusherClientOptions(
    authMethod: .endpoint(authEndpoint: "https://your-api.com/api/broadcasting/auth"),
    host: .host("aps.khajumsanjog.com"),
    port: 443,
    useTLS: true
)

// Add Authorization header with Bearer token:
var requestModifier: ((URLRequest) -> URLRequest) = { request in
    var modifiedRequest = request
    if let token = UserDefaults.standard.string(forKey: "auth_token") {
        modifiedRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    return modifiedRequest
}
authOptions.requestModifier = requestModifier

pusher = Pusher(key: "aps_key_demo_12345", options: authOptions)

// 2. Subscribe to Private Channel
let privateChannel = pusher.subscribe("private-orders-1001")

let _ = privateChannel.bind(eventName: "status_changed") { (event: PusherEvent) in
    print("Private status update: \(event.data ?? "")")
}
```

### 3.3 Presence Channels

Presence channels (`presence-*`) track user state and membership:

```swift
let presenceChannel = pusher.subscribeToPresenceChannel(channelName: "presence-chat-room")

// Listen for member events:
let _ = presenceChannel.bind(eventName: "pusher:subscription_succeeded") { (event: PusherEvent) in
    print("Subscribed! Active members: \(presenceChannel.members.count)")
    for member in presenceChannel.members {
        print("Member online: \(member.userId) - \(member.userInfo ?? [:])")
    }
}

let _ = presenceChannel.bind(eventName: "pusher:member_added") { (event: PusherEvent) in
    print("User joined room: \(event.data ?? "")")
}

let _ = presenceChannel.bind(eventName: "pusher:member_removed") { (event: PusherEvent) in
    print("User left room: \(event.data ?? "")")
}
```

---

## 4. Handling Connection Lifecycle & Reconnection

Conform to `PusherDelegate` to handle reconnections and network drops:

```swift
extension RealtimeManager: PusherDelegate {
    func changedConnectionState(from old: ConnectionState, to new: ConnectionState) {
        print("APS Connection transitioned from \(old.stringValue()) to \(new.stringValue())")
        
        switch new {
        case .connected:
            print("Connected! Socket ID: \(pusher.connection.socketId ?? "")")
        case .connecting:
            print("Attempting to connect...")
        case .disconnected:
            print("Disconnected. PusherSwift will auto-reconnect with exponential backoff.")
        case .reconnecting:
            print("Reconnecting to APS...")
        }
    }
    
    func debugLog(message: String) {
        #if DEBUG
        print("[APS Debug] \(message)")
        #endif
    }
    
    func failedToSubscribeToChannel(name: String, response: URLResponse?, data: String?, error: NSError?) {
        print("Failed to subscribe to channel: \(name). Error: \(error?.localizedDescription ?? data ?? "unknown")")
    }
    
    func receivedError(error: PusherError) {
        print("APS Server Error: code \(error.code ?? -1), message: \(error.message)")
    }
}
```

---

## 5. Local Testing on iOS Simulator

When running APS locally on your Mac (`localhost:8080`) without an SSL certificate:

```swift
let localOptions = PusherClientOptions(
    host: .host("127.0.0.1"),
    port: 8080,
    useTLS: false,
    cluster: "mt1"
)
pusher = Pusher(key: "aps_key_demo_12345", options: localOptions)
```

In your app's `Info.plist`, configure App Transport Security (ATS) to permit local development traffic:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>
```

---

## 6. APS Beams (Push Notifications for iOS via APNs)

APS Beams supports native Apple Push Notification Service (APNs) over HTTP/2.

### Step 1: Register Device Token in `AppDelegate.swift`
```swift
import UIKit
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Request Push Permissions:
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("APNs Device Token: \(tokenString)")
        
        // Register token with APS Beams:
        registerWithApsBeams(token: tokenString, interests: ["announcements", "donations"])
    }

    private func registerWithApsBeams(token: String, interests: [String]) {
        guard let url = URL(string: "https://aps.khajumsanjog.com/beams/beams_demo_instance/devices/apns/register") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "token": token,
            "interests": interests
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("Failed to register with APS Beams: \(error)")
            } else {
                print("Successfully registered iOS device with APS Beams!")
            }
        }.resume()
    }
}
```

---

## 7. Production Hardening

1. **Always use TLS in production**: `useTLS: true` and port `443`.
2. **Handle Backgrounding**: When the user backgrounds the app, WebSockets disconnect after the OS grace period. Listen for `UIApplication.willEnterForegroundNotification` to reconnect if needed:
   ```swift
   NotificationCenter.default.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { _ in
       if RealtimeManager.shared.pusher.connection.connectionState != .connected {
           RealtimeManager.shared.connect()
       }
   }
   ```
3. **Clean Unsubscribes**: Call `pusher.unsubscribe("channel-name")` when leaving specific View Controllers to preserve bandwidth.
