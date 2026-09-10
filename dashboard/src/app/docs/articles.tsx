import React from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export function CodeBlock({ code, language = "javascript", filename }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden bg-[#0d1117] border border-gray-800 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-800 text-xs text-gray-400">
        <span className="font-mono text-gray-300">{filename || language}</span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition cursor-pointer px-2 py-0.5 rounded hover:bg-gray-800"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-gray-100 overflow-x-auto leading-relaxed whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function SectionAnchor({ id, title }: { id: string; title: string }) {
  return (
    <h2 id={id} className="text-2xl font-bold text-gray-900 mt-10 mb-4 flex items-center gap-2 group scroll-mt-24">
      <a href={`#${id}`} className="text-[#6941C6] hover:text-[#521b68] flex items-center no-underline" title="Direct link to heading">
        <span className="font-mono text-xl font-normal opacity-70 group-hover:opacity-100 mr-1.5">🔗</span>
      </a>
      <span>{title}</span>
    </h2>
  );
}

export const ARTICLES_MAP: Record<string, {
  title: string;
  category: "CHANNELS" | "BEAMS" | "SERVER" | "DEPLOYMENT";
  description: string;
  tableOfContents: { id: string; title: string }[];
  content: React.ReactNode;
}> = {
  "javascript-quickstart": {
    title: "JavaScript quick start",
    category: "CHANNELS",
    description: "To publish an event to your web app using APS Channels, follow this guide.",
    tableOfContents: [
      { id: "get-api-keys", title: "Get your free API keys" },
      { id: "include-client", title: "Include the Channels Client" },
      { id: "open-connection", title: "Open a connection to Channels" },
      { id: "subscribe-channel", title: "Subscribe to a channel" },
      { id: "listen-events", title: "Listen for events on your channel" },
      { id: "trigger-events", title: "Trigger events from your server" },
      { id: "where-next", title: "Where next?" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          To publish an event to your web app using <strong>APS Channels</strong>, follow this guide.
          If you need any help, check the <Link href="/docs?doc=debugging" className="text-[#6941C6] hover:underline font-medium">Debugging Guide</Link> or view our <Link href="/login" className="text-[#6941C6] hover:underline font-medium">Developer Console</Link>.
        </p>

        <SectionAnchor id="get-api-keys" title="Get your free API keys" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          <Link href="/register" className="text-[#6941C6] hover:underline font-medium">Create an account</Link> and then create a Channels app. To get API keys, from the APS Developer Console, navigate to <strong>App Keys</strong>. Copy your <code className="bg-purple-50 text-[#6941C6] px-1.5 py-0.5 rounded border border-purple-200 text-xs font-mono">app_id</code>, <code className="bg-purple-50 text-[#6941C6] px-1.5 py-0.5 rounded border border-purple-200 text-xs font-mono">key</code>, <code className="bg-purple-50 text-[#6941C6] px-1.5 py-0.5 rounded border border-purple-200 text-xs font-mono">secret</code>, and <code className="bg-purple-50 text-[#6941C6] px-1.5 py-0.5 rounded border border-purple-200 text-xs font-mono">cluster</code>.
        </p>

        <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200/80 mb-6 text-sm text-purple-950 flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div>
            <strong>Demo Sandbox Credentials Available:</strong> If you are testing locally, you can use App ID <code className="font-mono text-xs">100001</code>, Key <code className="font-mono text-xs">aps_key_demo_12345</code>, and Secret <code className="font-mono text-xs">aps_secret_demo_67890</code> without registration.
          </div>
        </div>

        <SectionAnchor id="include-client" title="Include the Channels Client" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Install the official <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">pusher-js</code> library using npm, yarn, or include the script tag on your HTML page.
        </p>
        <CodeBlock
          filename="terminal"
          language="bash"
          code={`# npm
npm install pusher-js

# yarn
yarn add pusher-js

# Or include via CDN in HTML
<script src="https://js.pusher.com/8.4/pusher.min.js"></script>`}
        />

        <SectionAnchor id="open-connection" title="Open a connection to Channels" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Initialize a new <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">Pusher</code> instance pointing to your APS WebSocket host and port.
        </p>
        <CodeBlock
          filename="app.js"
          language="javascript"
          code={`import Pusher from 'pusher-js';

// Enable logger in development
// Pusher.logToConsole = true;

const pusher = new Pusher('aps_key_demo_12345', {
  wsHost: 'localhost',      // Or 'aps.khajumsanjog.com' in production
  wsPort: 8080,             // Port 8080 for plain WebSockets
  wssPort: 443,             // Port 443 for TLS WebSockets
  enabledTransports: ['ws', 'wss'],
  forceTLS: false,          // Set to true in production with SSL
  cluster: 'mt1',
});`}
        />

        <SectionAnchor id="subscribe-channel" title="Subscribe to a channel" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Channels allow you to filter real-time traffic so clients only receive messages intended for them.
        </p>
        <CodeBlock
          filename="app.js"
          language="javascript"
          code={`// Subscribe to a public channel
const channel = pusher.subscribe('my-channel');`}
        />

        <SectionAnchor id="listen-events" title="Listen for events on your channel" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Bind a callback function to listen for specific named events broadcast over your channel:
        </p>
        <CodeBlock
          filename="app.js"
          language="javascript"
          code={`channel.bind('my-event', (data) => {
  console.log('Received real-time event:', data);
  alert('Event received: ' + JSON.stringify(data));
});`}
        />

        <SectionAnchor id="trigger-events" title="Trigger events from your server" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Broadcast an event from your backend using any official Pusher server SDK (Node.js, PHP, Python, Go) or a standard cURL HTTP request:
        </p>
        <CodeBlock
          filename="server.js"
          language="javascript"
          code={`const Pusher = require('pusher');

const pusher = new Pusher({
  appId: '100001',
  key: 'aps_key_demo_12345',
  secret: 'aps_secret_demo_67890',
  host: 'localhost',
  port: '8080',
  useTLS: false,
});

pusher.trigger('my-channel', 'my-event', {
  message: 'hello world from server'
});`}
        />

        <p className="text-sm text-gray-700 leading-relaxed mt-4 mb-2">Or trigger instantly via cURL:</p>
        <CodeBlock
          filename="terminal"
          language="bash"
          code={`curl -X POST http://localhost:8080/apps/100001/events \\
  -H "Authorization: Bearer aps_key_demo_12345" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "my-event",
    "channel": "my-channel",
    "data": "{\\"message\\": \\"hello from curl\\"}"
  }'`}
        />

        <SectionAnchor id="where-next" title="Where next?" />
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-2 mt-2">
          <li>Check out the <Link href="/docs?doc=android-quickstart" className="text-[#6941C6] hover:underline font-medium">Android quick start</Link> for mobile apps.</li>
          <li>Learn about <Link href="/docs?doc=private-channels" className="text-[#6941C6] hover:underline font-medium">Private channels & authentication</Link> to secure sensitive data.</li>
          <li>Explore <Link href="/docs?doc=presence-channels" className="text-[#6941C6] hover:underline font-medium">Presence channels</Link> to build who's-online indicators and live chat rooms.</li>
          <li>Deploy APS with zero monthly limits using our <Link href="/docs?doc=cpanel-hosting" className="text-[#6941C6] hover:underline font-medium">cPanel Guide</Link> or <Link href="/docs?doc=ec2-ubuntu-guide" className="text-[#6941C6] hover:underline font-medium">AWS EC2 Guide</Link>.</li>
        </ul>
      </div>
    ),
  },

  "android-quickstart": {
    title: "Android quick start",
    category: "CHANNELS",
    description: "Complete guide to integrate APS Channels into Android apps using Kotlin and Java.",
    tableOfContents: [
      { id: "gradle-setup", title: "1. Add Gradle Dependency" },
      { id: "network-config", title: "2. Android Permissions & Cleartext" },
      { id: "configure-pusher", title: "3. Connect with PusherOptions" },
      { id: "subscribe-events", title: "4. Subscribe & Listen to Events" },
      { id: "beams-push", title: "5. Mobile Push with APS Beams (FCM)" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          Connect your Android application to <strong>APS Channels</strong> using the standard <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">pusher-java-client</code> library.
        </p>

        <SectionAnchor id="gradle-setup" title="1. Add Gradle Dependency" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          In your app's <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">build.gradle.kts</code>:
        </p>
        <CodeBlock
          filename="build.gradle.kts"
          language="kotlin"
          code={`dependencies {
    implementation("com.pusher:pusher-java-client:2.4.4")
}`}
        />

        <SectionAnchor id="network-config" title="2. Android Permissions & Cleartext" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          In <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">AndroidManifest.xml</code>, request Internet permissions:
        </p>
        <CodeBlock
          filename="AndroidManifest.xml"
          language="xml"
          code={`<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- For local emulator testing (10.0.2.2), allow cleartext: -->
    <application
        android:usesCleartextTraffic="true"
        ... >
    </application>
</manifest>`}
        />

        <SectionAnchor id="configure-pusher" title="3. Connect with PusherOptions" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Point the options at your APS host (use <code className="font-mono text-xs">10.0.2.2</code> to access your Mac/PC localhost from the standard Android Emulator):
        </p>
        <CodeBlock
          filename="MainActivity.kt"
          language="kotlin"
          code={`import com.pusher.client.Pusher
import com.pusher.client.PusherOptions
import com.pusher.client.connection.ConnectionEventListener
import com.pusher.client.connection.ConnectionState
import com.pusher.client.connection.ConnectionStateChange
import android.util.Log

class MainActivity : AppCompatActivity() {
    private lateinit var pusher: Pusher

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val options = PusherOptions().apply {
            setCluster("mt1")
            setHost("10.0.2.2") // Android emulator alias for computer localhost
            setWsPort(8080)
            setWssPort(443)
            isUseTLS = false     // true in production with SSL
        }

        pusher = Pusher("aps_key_demo_12345", options)

        pusher.connect(object : ConnectionEventListener {
            override fun onConnectionStateChange(change: ConnectionStateChange) {
                Log.d("APS", "State: \${change.previousState} -> \${change.currentState}")
            }

            override fun onError(message: String, code: String?, e: Exception?) {
                Log.e("APS", "Error: \$message (code: \$code)", e)
            }
        }, ConnectionState.ALL)
    }
}`}
        />

        <SectionAnchor id="subscribe-events" title="4. Subscribe & Listen to Events" />
        <CodeBlock
          filename="MainActivity.kt"
          language="kotlin"
          code={`val channel = pusher.subscribe("orders")

channel.bind("new-order") { event ->
    runOnUiThread {
        Log.d("APS", "Received order: \${event.data}")
    }
}`}
        />

        <SectionAnchor id="beams-push" title="5. Mobile Push with APS Beams (FCM)" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Register your Android FCM device token with APS Beams to receive background push notifications:
        </p>
        <CodeBlock
          filename="MyFirebaseMessagingService.kt"
          language="kotlin"
          code={`import com.google.firebase.messaging.FirebaseMessagingService
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class MyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        val client = OkHttpClient()
        val json = """{"token": "$token", "interests": ["announcements"]}"""
        val body = json.toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url("https://aps.khajumsanjog.com/beams/beams_demo_instance/devices/fcm/register")
            .post(body)
            .build()
            
        client.newCall(request).execute()
    }
}`}
        />
      </div>
    ),
  },

  "ios-quickstart": {
    title: "iOS quick start",
    category: "CHANNELS",
    description: "Integrate APS Channels into iOS apps with Swift using PusherSwift.",
    tableOfContents: [
      { id: "install-spm", title: "1. Install via Swift Package Manager" },
      { id: "swift-connect", title: "2. Initialize & Connect" },
      { id: "subscribe-swift", title: "3. Subscribe & Handle Events" },
      { id: "simulator-ats", title: "4. iOS Simulator ATS Configuration" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          Build reactive iOS applications with <strong>APS Channels</strong> using the official <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">PusherSwift</code> library.
        </p>

        <SectionAnchor id="install-spm" title="1. Install via Swift Package Manager" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          In Xcode, select <strong>File → Add Packages...</strong> and enter:
        </p>
        <CodeBlock
          filename="Xcode Package URL"
          language="text"
          code={`https://github.com/pusher/pusher-websocket-swift`}
        />

        <SectionAnchor id="swift-connect" title="2. Initialize & Connect" />
        <CodeBlock
          filename="RealtimeService.swift"
          language="swift"
          code={`import UIKit
import PusherSwift

class RealtimeService: PusherDelegate {
    var pusher: Pusher!

    func start() {
        let options = PusherClientOptions(
            host: .host("aps.khajumsanjog.com"), // "127.0.0.1" for simulator local testing
            port: 443,
            useTLS: true,
            cluster: "mt1"
        )

        pusher = Pusher(key: "aps_key_demo_12345", options: options)
        pusher.delegate = self
        pusher.connect()
    }
}`}
        />

        <SectionAnchor id="subscribe-swift" title="3. Subscribe & Handle Events" />
        <CodeBlock
          filename="RealtimeService.swift"
          language="swift"
          code={`let channel = pusher.subscribe("orders")

let _ = channel.bind(eventName: "status_changed") { (event: PusherEvent) in
    if let data = event.data {
        print("Real-time order update: \\(data)")
    }
}`}
        />

        <SectionAnchor id="simulator-ats" title="4. iOS Simulator ATS Configuration" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          When testing against local <code className="font-mono text-xs">127.0.0.1:8080</code> without SSL, add to your <code className="font-mono text-xs">Info.plist</code>:
        </p>
        <CodeBlock
          filename="Info.plist"
          language="xml"
          code={`<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>`}
        />
      </div>
    ),
  },

  "flutter-quickstart": {
    title: "Flutter quick start",
    category: "CHANNELS",
    description: "Cross-platform real-time messaging for iOS, Android, and Web using Flutter.",
    tableOfContents: [
      { id: "flutter-pubspec", title: "1. pubspec.yaml Dependency" },
      { id: "flutter-init", title: "2. Initialize & Connect" },
      { id: "flutter-events", title: "3. Listen for Channel Events" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          Use the official <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">pusher_channels_flutter</code> plugin to connect Flutter apps on iOS, Android, and Web.
        </p>

        <SectionAnchor id="flutter-pubspec" title="1. pubspec.yaml Dependency" />
        <CodeBlock
          filename="pubspec.yaml"
          language="yaml"
          code={`dependencies:
  flutter:
    sdk: flutter
  pusher_channels_flutter: ^2.2.1`}
        />

        <SectionAnchor id="flutter-init" title="2. Initialize & Connect" />
        <CodeBlock
          filename="lib/realtime.dart"
          language="dart"
          code={`import 'package:pusher_channels_flutter/pusher_channels_flutter.dart';

final pusher = PusherChannelsFlutter.getInstance();

await pusher.init(
  apiKey: "aps_key_demo_12345",
  cluster: "mt1",
  host: "aps.khajumsanjog.com", // "10.0.2.2" for Android emulator / "127.0.0.1" for iOS
  wsPort: 8080,
  wssPort: 443,
  useTLS: true,
  onConnectionStateChange: (currentState, previousState) {
    print("APS Connection: $previousState -> $currentState");
  },
  onEvent: (event) {
    print("Event Received: \${event.eventName} : \${event.data}");
  },
);

await pusher.connect();`}
        />

        <SectionAnchor id="flutter-events" title="3. Listen for Channel Events" />
        <CodeBlock
          filename="lib/realtime.dart"
          language="dart"
          code={`await pusher.subscribe(
  channelName: "chat-room",
  onEvent: (PusherEvent event) {
    print("Chat message: \${event.data}");
  },
);`}
        />
      </div>
    ),
  },

  "react-native-quickstart": {
    title: "React Native quick start",
    category: "CHANNELS",
    description: "Build real-time iOS and Android apps using React Native and pusher-js.",
    tableOfContents: [
      { id: "rn-install", title: "1. Installation" },
      { id: "rn-connect", title: "2. Connect & Subscribe" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          React Native works seamlessly with <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">pusher-js</code> on both iOS and Android.
        </p>

        <SectionAnchor id="rn-install" title="1. Installation" />
        <CodeBlock
          filename="terminal"
          language="bash"
          code={`npm install pusher-js @react-native-community/netinfo`}
        />

        <SectionAnchor id="rn-connect" title="2. Connect & Subscribe" />
        <CodeBlock
          filename="App.js"
          language="javascript"
          code={`import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Pusher from 'pusher-js';

export default function App() {
  const [message, setMessage] = useState('Waiting for events...');

  useEffect(() => {
    const pusher = new Pusher('aps_key_demo_12345', {
      wsHost: 'aps.khajumsanjog.com',
      wssPort: 443,
      forceTLS: true,
      cluster: 'mt1',
    });

    const channel = pusher.subscribe('notifications');
    channel.bind('alert', (data) => {
      setMessage(data.text);
    });

    return () => {
      pusher.unsubscribe('notifications');
      pusher.disconnect();
    };
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>{message}</Text>
    </View>
  );
}`}
        />
      </div>
    ),
  },

  "realtime-chat": {
    title: "Javascript realtime chat",
    category: "CHANNELS",
    description: "Step-by-step use case tutorial building a multi-user real-time chat room.",
    tableOfContents: [
      { id: "chat-overview", title: "Architecture" },
      { id: "chat-frontend", title: "Frontend Implementation" },
      { id: "chat-backend", title: "Backend Trigger" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          Learn how to build a production real-time chat room where messages appear instantly across all browser tabs without polling.
        </p>

        <SectionAnchor id="chat-overview" title="Architecture" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          1. Users connect to APS WebSockets and subscribe to <code className="font-mono text-xs">presence-chat</code>.<br />
          2. When a user sends a message, they POST to your backend API.<br />
          3. Your backend broadcasts the message via APS, which relays it to all connected sockets in under 1 millisecond.
        </p>

        <SectionAnchor id="chat-frontend" title="Frontend Implementation" />
        <CodeBlock
          filename="chat.js"
          language="javascript"
          code={`const pusher = new Pusher('aps_key_demo_12345', {
  wsHost: 'aps.khajumsanjog.com',
  wssPort: 443,
  forceTLS: true,
  cluster: 'mt1',
});

const channel = pusher.subscribe('chat-room');

channel.bind('new_message', (msg) => {
  const container = document.getElementById('messages');
  container.innerHTML += \`<div class="msg"><strong>\${msg.author}:</strong> \${msg.text}</div>\`;
});

function sendMessage(text) {
  fetch('/api/chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}`}
        />

        <SectionAnchor id="chat-backend" title="Backend Trigger" />
        <CodeBlock
          filename="server.js"
          language="javascript"
          code={`app.post('/api/chat/send', async (req, res) => {
  const { text } = req.body;
  
  await pusher.trigger('chat-room', 'new_message', {
    author: req.user.name,
    text: text,
    timestamp: Date.now(),
  });

  res.json({ status: 'ok' });
});`}
        />
      </div>
    ),
  },

  "realtime-user-list": {
    title: "Javascript realtime user list",
    category: "CHANNELS",
    description: "Build an active presence user list showing who is online in real time.",
    tableOfContents: [
      { id: "presence-intro", title: "What are Presence Channels?" },
      { id: "presence-client", title: "Listening for Members" },
      { id: "presence-server-auth", title: "Backend Authorization" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          Presence channels allow clients to register their identities and track who enters or leaves a channel automatically.
        </p>

        <SectionAnchor id="presence-intro" title="What are Presence Channels?" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Channels prefixed with <code className="font-mono text-xs bg-purple-50 text-[#6941C6] px-1 py-0.5 rounded">presence-</code> require authentication and maintain a real-time roster of connected users.
        </p>

        <SectionAnchor id="presence-client" title="Listening for Members" />
        <CodeBlock
          filename="presence.js"
          language="javascript"
          code={`const presenceChannel = pusher.subscribe('presence-room-1');

// 1. Initial list of users already in the room
presenceChannel.bind('pusher:subscription_succeeded', (members) => {
  console.log('Total members online:', members.count);
  members.each((member) => {
    addUserToList(member.id, member.info);
  });
});

// 2. Another user joined
presenceChannel.bind('pusher:member_added', (member) => {
  addUserToList(member.id, member.info);
  showToast(\`\${member.info.name} joined the room\`);
});

// 3. User disconnected or closed their tab
presenceChannel.bind('pusher:member_removed', (member) => {
  removeUserFromList(member.id);
  showToast(\`\${member.info.name} left\`);
});`}
        />

        <SectionAnchor id="presence-server-auth" title="Backend Authorization" />
        <CodeBlock
          filename="auth.js"
          language="javascript"
          code={`app.post('/api/broadcasting/auth', (req, res) => {
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;

  const presenceData = {
    user_id: req.user.id,
    user_info: {
      name: req.user.name,
      avatar: req.user.avatarUrl,
    },
  };

  const auth = pusher.authorizeChannel(socketId, channel, presenceData);
  res.send(auth);
});`}
        />
      </div>
    ),
  },

  "debugging": {
    title: "Debugging & live logs",
    category: "CHANNELS",
    description: "Diagnose connection issues, inspect live event streams, and verify server health.",
    tableOfContents: [
      { id: "debug-console", title: "1. Developer Console Live Debugger" },
      { id: "debug-terminal", title: "2. Terminal Tailing with apsctl" },
      { id: "debug-codes", title: "3. Common Error Codes & Solutions" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          APS provides built-in tools to inspect every WebSocket handshake, frame, and REST trigger in real time.
        </p>

        <SectionAnchor id="debug-console" title="1. Developer Console Live Debugger" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Visit <strong>Live Debug Console</strong> in your Developer Console (<Link href="/dashboard" className="text-[#6941C6] hover:underline font-medium">http://localhost:3000/dashboard</Link>).
          Every event sent to your app appears live with its channel name, payload, and socket timestamp.
        </p>

        <SectionAnchor id="debug-terminal" title="2. Terminal Tailing with apsctl" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Stream live events directly in your terminal using the built-in CLI:
        </p>
        <CodeBlock
          filename="terminal"
          language="bash"
          code={`# Check health
./apsctl status

# Live stream events from a channel
./apsctl tail aps_key_demo_12345 my-channel`}
        />

        <SectionAnchor id="debug-codes" title="3. Common Error Codes & Solutions" />
        <div className="overflow-x-auto my-4">
          <table className="w-full text-left text-xs border border-gray-200 rounded-lg">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
              <tr>
                <th className="p-3">Error Code</th>
                <th className="p-3">Cause</th>
                <th className="p-3">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              <tr>
                <td className="p-3 font-mono font-bold text-red-600">4001</td>
                <td className="p-3">App Key does not exist</td>
                <td className="p-3">Verify the app_key passed to your client matches your Developer Console.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-red-600">4004</td>
                <td className="p-3">App is disabled</td>
                <td className="p-3">Enable the application from the dashboard.</td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-red-600">4009</td>
                <td className="p-3">Ping / Pong connection timeout</td>
                <td className="p-3">Check firewall rules on port 8080 / 443.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },

  "client-api-overview": {
    title: "Client API overview",
    category: "CHANNELS",
    description: "Understanding connection lifecycle, events, channel naming conventions, and security.",
    tableOfContents: [
      { id: "channel-types", title: "Channel Naming Conventions" },
      { id: "connection-lifecycle", title: "Connection Lifecycle" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          APS implements the official Pusher Channels Protocol v7. Any client SDK compatible with Pusher works out of the box.
        </p>

        <SectionAnchor id="channel-types" title="Channel Naming Conventions" />
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-3">
          <li><strong>Public Channels:</strong> Any name that does not start with <code className="font-mono text-xs">private-</code> or <code className="font-mono text-xs">presence-</code> (e.g. <code className="font-mono text-xs">news</code>, <code className="font-mono text-xs">crypto-ticks</code>). No authentication required.</li>
          <li><strong>Private Channels:</strong> Prefixed with <code className="font-mono text-xs bg-purple-50 text-[#6941C6] px-1 py-0.5 rounded">private-</code> (e.g. <code className="font-mono text-xs">private-user-1001</code>). Requires signature from your backend server.</li>
          <li><strong>Presence Channels:</strong> Prefixed with <code className="font-mono text-xs bg-purple-50 text-[#6941C6] px-1 py-0.5 rounded">presence-</code> (e.g. <code className="font-mono text-xs">presence-chat-room</code>). Authenticated and tracks user membership.</li>
        </ul>

        <SectionAnchor id="connection-lifecycle" title="Connection Lifecycle" />
        <CodeBlock
          filename="lifecycle.js"
          language="javascript"
          code={`pusher.connection.bind('state_change', (states) => {
  console.log(\`Connection: \${states.previous} -> \${states.current}\`);
});

pusher.connection.bind('connected', () => {
  console.log('Connected! Socket ID:', pusher.connection.socket_id);
});`}
        />
      </div>
    ),
  },

  "php-laravel": {
    title: "PHP & Laravel broadcasting",
    category: "SERVER",
    description: "Complete guide for PHP websites and Laravel broadcast driver integration.",
    tableOfContents: [
      { id: "laravel-setup", title: "1. Laravel Native Driver" },
      { id: "pure-php", title: "2. Native PHP without Framework" },
      { id: "cpanel-usage", title: "3. Broadcasting from cPanel Shared Hosting" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          Laravel features built-in native support for the Pusher protocol. You can point Laravel to APS with zero custom packages.
        </p>

        <SectionAnchor id="laravel-setup" title="1. Laravel Native Driver" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          In your <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">.env</code>:
        </p>
        <CodeBlock
          filename=".env"
          language="env"
          code={`BROADCAST_CONNECTION=pusher

PUSHER_APP_ID=100001
PUSHER_APP_KEY=aps_key_demo_12345
PUSHER_APP_SECRET=aps_secret_demo_67890
PUSHER_HOST=aps.khajumsanjog.com
PUSHER_PORT=443
PUSHER_SCHEME=https
PUSHER_APP_CLUSTER=mt1`}
        />

        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          In <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">config/broadcasting.php</code>:
        </p>
        <CodeBlock
          filename="config/broadcasting.php"
          language="php"
          code={`'pusher' => [
    'driver' => 'pusher',
    'key' => env('PUSHER_APP_KEY'),
    'secret' => env('PUSHER_APP_SECRET'),
    'app_id' => env('PUSHER_APP_ID'),
    'options' => [
        'cluster' => env('PUSHER_APP_CLUSTER'),
        'host' => env('PUSHER_HOST'),
        'port' => env('PUSHER_PORT', 443),
        'scheme' => env('PUSHER_SCHEME', 'https'),
        'useTLS' => env('PUSHER_SCHEME', 'https') === 'https',
    ],
],`}
        />

        <SectionAnchor id="pure-php" title="2. Native PHP without Framework" />
        <CodeBlock
          filename="trigger.php"
          language="php"
          code={`<?php
require __DIR__ . '/vendor/autoload.php';

use Pusher\\Pusher;

$pusher = new Pusher(
    'aps_key_demo_12345',
    'aps_secret_demo_67890',
    '100001',
    ['host' => 'aps.khajumsanjog.com', 'port' => 443, 'scheme' => 'https', 'useTLS' => true]
);

$pusher->trigger('orders', 'new-order', ['id' => 101, 'total' => 2500]);`}
        />

        <SectionAnchor id="cpanel-usage" title="3. Broadcasting from cPanel Shared Hosting" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          If your website runs on shared cPanel hosting, you can broadcast real-time events without any root access:
          PHP sends an outbound HTTPS request to APS on your VPS, while visitors connect to WebSockets directly.
          See the <Link href="/docs?doc=cpanel-hosting" className="text-[#6941C6] hover:underline font-medium">cPanel Deployment Guide</Link> for details.
        </p>
      </div>
    ),
  },

  "nodejs-server": {
    title: "Node.js & TypeScript",
    category: "SERVER",
    description: "Server integration for Express, Fastify, NestJS, and Next.js App Router.",
    tableOfContents: [
      { id: "node-install", title: "1. Installation" },
      { id: "node-trigger", title: "2. Triggering Events" },
      { id: "node-auth", title: "3. Channel Authorization Route" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          Publish real-time events and verify private channel signatures in Node.js and TypeScript.
        </p>

        <SectionAnchor id="node-install" title="1. Installation" />
        <CodeBlock
          filename="terminal"
          language="bash"
          code={`npm install pusher`}
        />

        <SectionAnchor id="node-trigger" title="2. Triggering Events" />
        <CodeBlock
          filename="broadcast.ts"
          language="typescript"
          code={`import Pusher from 'pusher';

const pusher = new Pusher({
  appId: '100001',
  key: 'aps_key_demo_12345',
  secret: 'aps_secret_demo_67890',
  host: 'aps.khajumsanjog.com',
  port: '443',
  useTLS: true,
  cluster: 'mt1',
});

// Single event
await pusher.trigger('orders', 'status-updated', { id: 101, status: 'shipped' });

// Batch events
await pusher.triggerBatch([
  { channel: 'orders', name: 'status', data: { id: 101 } },
  { channel: 'notifications', name: 'alert', data: { text: 'New update' } },
]);`}
        />

        <SectionAnchor id="node-auth" title="3. Channel Authorization Route" />
        <CodeBlock
          filename="auth-endpoint.ts"
          language="typescript"
          code={`app.post('/api/broadcasting/auth', (req, res) => {
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;

  if (!req.user) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const auth = pusher.authorizeChannel(socketId, channel);
  res.send(auth);
});`}
        />
      </div>
    ),
  },

  "python-server": {
    title: "Python (FastAPI, Django)",
    category: "SERVER",
    description: "Trigger real-time events and authenticate channels in Python frameworks.",
    tableOfContents: [
      { id: "py-install", title: "1. Installation" },
      { id: "py-trigger", title: "2. Triggering Events" },
      { id: "py-fastapi", title: "3. FastAPI Auth Endpoint" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          Trigger events and manage subscriptions in Python using the official <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">pusher</code> package.
        </p>

        <SectionAnchor id="py-install" title="1. Installation" />
        <CodeBlock
          filename="terminal"
          language="bash"
          code={`pip install pusher`}
        />

        <SectionAnchor id="py-trigger" title="2. Triggering Events" />
        <CodeBlock
          filename="broadcast.py"
          language="python"
          code={`import pusher

client = pusher.Pusher(
    app_id='100001',
    key='aps_key_demo_12345',
    secret='aps_secret_demo_67890',
    host='aps.khajumsanjog.com',
    port=443,
    ssl=True,
    cluster='mt1'
)

client.trigger('orders', 'order-placed', {'order_id': 9821, 'amount': 1500})`}
        />

        <SectionAnchor id="py-fastapi" title="3. FastAPI Auth Endpoint" />
        <CodeBlock
          filename="main.py"
          language="python"
          code={`from fastapi import FastAPI, Form
from fastapi.responses import JSONResponse

app = FastAPI()

@app.post("/api/broadcasting/auth")
async def auth(channel_name: str = Form(...), socket_id: str = Form(...)):
    auth_response = client.authenticate(channel=channel_name, socket_id=socket_id)
    return JSONResponse(content=auth_response)`}
        />
      </div>
    ),
  },

  "beams-overview": {
    title: "Beams Push overview",
    category: "BEAMS",
    description: "Multi-platform mobile and web push notifications with FCM and APNs.",
    tableOfContents: [
      { id: "beams-arch", title: "Architecture" },
      { id: "beams-register", title: "Device Token Registration" },
      { id: "beams-publish", title: "Publishing Push to Interests" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          <strong>APS Beams</strong> delivers push notifications directly to iOS (APNs over HTTP/2) and Android/Web (FCM HTTP v1 API).
        </p>

        <SectionAnchor id="beams-arch" title="Architecture" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Devices register their device tokens and subscribe to topic <strong>Interests</strong>. When you publish a notification to an interest, APS delivers it to all registered devices in parallel.
        </p>

        <SectionAnchor id="beams-register" title="Device Token Registration" />
        <CodeBlock
          filename="terminal"
          language="bash"
          code={`curl -X POST https://aps.khajumsanjog.com/beams/beams_demo_instance/devices/fcm/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "DEVICE_FCM_TOKEN_HERE",
    "interests": ["announcements", "donations"]
  }'`}
        />

        <SectionAnchor id="beams-publish" title="Publishing Push to Interests" />
        <CodeBlock
          filename="terminal"
          language="bash"
          code={`curl -X POST https://aps.khajumsanjog.com/beams/beams_demo_instance/publishes/interests \\
  -H "Content-Type: application/json" \\
  -d '{
    "interests": ["announcements"],
    "fcm": {
      "notification": {
        "title": "Special Announcement",
        "body": "Welcome to our live festival event!"
      }
    }
  }'`}
        />
      </div>
    ),
  },

  "cpanel-hosting": {
    title: "cPanel Shared Hosting guide",
    category: "DEPLOYMENT",
    description: "How to use APS alongside cPanel shared hosting using the recommended hybrid architecture.",
    tableOfContents: [
      { id: "cpanel-verdict", title: "Can Shared cPanel Run APS?" },
      { id: "hybrid-arch", title: "The Hybrid Model Explained" },
      { id: "step-by-step", title: "Step-by-Step Setup" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          Learn how to seamlessly integrate real-time WebSockets with PHP applications hosted on shared cPanel hosting.
        </p>

        <SectionAnchor id="cpanel-verdict" title="Can Shared cPanel Run APS?" />
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm mb-6 leading-relaxed">
          <strong>Key Rule:</strong> Shared cPanel hosting accounts terminate long-running background processes (CloudLinux process watchers) and do not allow persistent WebSocket daemons. However, <strong>your PHP website on cPanel can publish events to APS on a VPS with zero issues!</strong>
        </div>

        <SectionAnchor id="hybrid-arch" title="The Hybrid Model Explained" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          1. <strong>Keep your website and database on cPanel</strong> (PHP files, MySQL database, email).<br />
          2. <strong>Run APS on a small VPS</strong> ($3.50/mo AWS EC2 or free VM).<br />
          3. When an event happens on your website (e.g. order placed), PHP sends an outbound HTTPS request to APS.<br />
          4. Visitors connect their browsers directly to APS over WebSockets.
        </p>

        <SectionAnchor id="step-by-step" title="Step-by-Step Setup" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          In your cPanel DNS zone editor, add an A record: <code className="font-mono text-xs">aps.yourdomain.com → YOUR_VPS_IP</code>.
          Then in your PHP code on cPanel:
        </p>
        <CodeBlock
          filename="order_done.php"
          language="php"
          code={`<?php
require 'vendor/autoload.php';

$pusher = new Pusher\\Pusher('aps_key_demo_12345', 'aps_secret_demo_67890', '100001', [
    'host' => 'aps.yourdomain.com',
    'port' => 443,
    'scheme' => 'https',
    'useTLS' => true
]);

$pusher->trigger('orders', 'paid', ['order_id' => 1042]);`}
        />
      </div>
    ),
  },

  "ec2-ubuntu-guide": {
    title: "AWS EC2 & Ubuntu VPS guide",
    category: "DEPLOYMENT",
    description: "Production deployment on an AWS EC2 instance with systemd and Caddy auto-TLS.",
    tableOfContents: [
      { id: "ec2-sizing", title: "1. Hardware Sizing" },
      { id: "ec2-systemd", title: "2. Systemd Daemon Service" },
      { id: "ec2-caddy", title: "3. Caddy Reverse Proxy & SSL" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          Deploy APS on AWS EC2 or any Ubuntu 22.04/24.04 VPS for rock-solid production performance.
        </p>

        <SectionAnchor id="ec2-sizing" title="1. Hardware Sizing" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          A tiny <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">t4g.micro</code> (2 vCPUs, 1GB RAM) on AWS handles over <strong>25,000 concurrent WebSockets</strong> thanks to Go goroutines.
        </p>

        <SectionAnchor id="ec2-systemd" title="2. Systemd Daemon Service" />
        <CodeBlock
          filename="/etc/systemd/system/aps.service"
          language="ini"
          code={`[Unit]
Description=APS Realtime Engine
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/aps
ExecStart=/opt/aps/aps all-in-one
Restart=always
RestartSec=5s
LimitNOFILE=65536
Environment="PORT=8080"
Environment="GIN_MODE=release"

[Install]
WantedBy=multi-user.target`}
        />

        <SectionAnchor id="ec2-caddy" title="3. Caddy Reverse Proxy & SSL" />
        <CodeBlock
          filename="/etc/caddy/Caddyfile"
          language="caddy"
          code={`aps.yourdomain.com {
    reverse_proxy localhost:8080
}

dashboard.yourdomain.com {
    reverse_proxy localhost:3000
}`}
        />
      </div>
    ),
  },

  "docker-compose-guide": {
    title: "Docker Compose production",
    category: "DEPLOYMENT",
    description: "Run the full container stack with PostgreSQL 16, Redis 7, Caddy, and Next.js 16.",
    tableOfContents: [
      { id: "docker-start", title: "1. Start the Stack" },
      { id: "docker-scale", title: "2. Horizontal Scaling" },
    ],
    content: (
      <div>
        <p className="text-base text-gray-700 leading-relaxed mb-6">
          Run APS with multi-container isolation, automatic TLS certificates, and Redis pub/sub bus.
        </p>

        <SectionAnchor id="docker-start" title="1. Start the Stack" />
        <CodeBlock
          filename="terminal"
          language="bash"
          code={`cd deploy
docker compose --env-file ../.env.production up -d --build`}
        />

        <SectionAnchor id="docker-scale" title="2. Horizontal Scaling" />
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          Scale your WebSocket servers across multiple instances with automatic load-balancing:
        </p>
        <CodeBlock
          filename="terminal"
          language="bash"
          code={`docker compose up -d --scale aps=3`}
        />
      </div>
    ),
  },
};
