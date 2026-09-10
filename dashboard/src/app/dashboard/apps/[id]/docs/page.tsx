"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchWithAuth, WS_HOST, WS_PORT } from "@/lib/api";
import {
  Code,
  Copy,
  Check,
  Terminal,
  Download,
  Radio,
  ExternalLink,
} from "lucide-react";

export default function AppDocsPage() {
  const params = useParams();
  const appId = params.id as string;

  const [app, setApp] = useState<any>(null);
  const [beamsInstance, setBeamsInstance] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedSdk, setSelectedSdk] = useState<"js" | "android" | "ios" | "flutter" | "node" | "php" | "python" | "go" | "curl">("js");
  const [activeCategory, setActiveCategory] = useState<"channels" | "beams" | "webhooks">("channels");

  // Dynamic custom channel and event for live personalized snippets
  const [customChannel, setCustomChannel] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`aps_docs_channel_${appId}`) || "my-channel";
    }
    return "my-channel";
  });
  const [customEvent, setCustomEvent] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`aps_docs_event_${appId}`) || "my-event";
    }
    return "my-event";
  });

  const activeChannel = customChannel.trim() || "my-channel";
  const activeEvent = customEvent.trim() || "my-event";

  useEffect(() => {
    if (!appId) return;
    loadApp();
  }, [appId]);

  const loadApp = async () => {
    try {
      const res = await fetchWithAuth(`/api/apps/${appId}`);
      if (res.ok) {
        const data = await res.json();
        setApp(data.app);
        setBeamsInstance(data.beams_instance);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentAppKey = app?.app_key || "YOUR_APP_KEY";
  const currentAppSecret = app?.app_secret || "YOUR_APP_SECRET";
  const currentAppId = app?.id || appId || "100001";
  const currentInstanceId = beamsInstance?.instance_id || "beams_demo_instance";
  const currentHost = typeof window !== "undefined" ? window.location.hostname : WS_HOST;

  const sdkSnippets = {
    js: `// Install official Pusher browser client:
// npm install pusher-js

import Pusher from 'pusher-js';

const pusher = new Pusher('${currentAppKey}', {
  wsHost: '${currentHost}',
  wsPort: ${WS_PORT},
  wssPort: 443,
  enabledTransports: ['ws', 'wss'],
  forceTLS: false,
  cluster: '${app?.cluster || "mt1"}',
});

const channel = pusher.subscribe('${activeChannel}');
channel.bind('${activeEvent}', (data) => {
  console.log('Real-time event received:', data);
});`,

    android: `// 1. In build.gradle.kts:
// implementation("com.pusher:pusher-java-client:2.4.4")

import com.pusher.client.Pusher
import com.pusher.client.PusherOptions
import android.util.Log

// 2. Configure connection pointing to your APS instance:
val options = PusherOptions().apply {
    setCluster("${app?.cluster || "mt1"}")
    setHost("${currentHost}")
    setWsPort(${WS_PORT})
    setWssPort(443)
    isUseTLS = false // Set true in production with HTTPS/WSS
}

val pusher = Pusher("${currentAppKey}", options)
pusher.connect()

// 3. Subscribe to channel & handle real-time events:
val channel = pusher.subscribe("${activeChannel}")
channel.bind("${activeEvent}") { event ->
    Log.d("APS", "Event payload: \${event.data}")
}`,

    ios: `// Swift Package Manager: https://github.com/pusher/pusher-websocket-swift
import PusherSwift

let options = PusherClientOptions(
    host: .host("${currentHost}"),
    port: ${WS_PORT},
    useTLS: false,
    cluster: "${app?.cluster || "mt1"}"
)
let pusher = Pusher(key: "${currentAppKey}", options: options)
let channel = pusher.subscribe("${activeChannel}")
let _ = channel.bind(eventName: "${activeEvent}") { (event: PusherEvent) in
    print("Received real-time event: \\(event.data ?? "")")
}
pusher.connect()`,

    flutter: `// In pubspec.yaml:
// pusher_channels_flutter: ^2.2.1

import 'package:pusher_channels_flutter/pusher_channels_flutter.dart';

final pusher = PusherChannelsFlutter.getInstance();

await pusher.init(
  apiKey: "${currentAppKey}",
  cluster: "${app?.cluster || "mt1"}",
  host: "${currentHost}",
  wsPort: ${WS_PORT},
  useTLS: false,
  onEvent: (event) => print("APS Event: \${event.data}"),
);

await pusher.subscribe(channelName: "${activeChannel}");
await pusher.connect();`,

    node: `// Install official Pusher server SDK:
// npm install pusher

const Pusher = require('pusher');

const pusher = new Pusher({
  appId: '${currentAppId}',
  key: '${currentAppKey}',
  secret: '${currentAppSecret}',
  host: '${currentHost}',
  port: '${WS_PORT}',
  useTLS: false,
});

pusher.trigger('${activeChannel}', '${activeEvent}', {
  message: 'Hello from Node.js server via APS!',
  timestamp: Date.now()
});`,

    php: `<?php
// composer require pusher/pusher-php-server
require __DIR__ . '/vendor/autoload.php';

use Pusher\\Pusher;

$pusher = new Pusher(
  '${currentAppKey}',
  '${currentAppSecret}',
  '${currentAppId}',
  [
    'cluster' => '${app?.cluster || "mt1"}',
    'host' => '${currentHost}',
    'port' => ${WS_PORT},
    'scheme' => 'http', // 'https' in production
    'useTLS' => false
  ]
);

$pusher->trigger('${activeChannel}', '${activeEvent}', [
  'message' => 'Hello from PHP / Laravel server via APS!',
  'timestamp' => time()
]);`,

    python: `# Install Pusher Python SDK:
// pip install pusher

from pusher import Pusher

pusher_client = Pusher(
    app_id='${currentAppId}',
    key='${currentAppKey}',
    secret='${currentAppSecret}',
    host='${currentHost}',
    port=${WS_PORT},
    ssl=False
)

pusher_client.trigger('${activeChannel}', '${activeEvent}', {
    'message': 'Hello from Python via APS!',
    'timestamp': 1789019000
})`,

    go: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	payload := map[string]any{
		"name":     "${activeEvent}",
		"channels": []string{"${activeChannel}"},
		"data": map[string]any{
			"message": "Hello from Go service via APS!",
		},
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", "http://${currentHost}:${WS_PORT}/apps/${currentAppId}/events", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer ${currentAppKey}")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	fmt.Println("Trigger Status:", resp.Status)
}`,

    curl: `# Trigger an event in 1 command:
curl -X POST http://${currentHost}:${WS_PORT}/apps/${currentAppId}/events \\
  -H "Authorization: Bearer ${currentAppKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "${activeEvent}",
    "channels": ["${activeChannel}"],
    "data": {
      "message": "Hello via cURL"
    }
  }'`,
  };

  const restEndpoints = [
    {
      category: "channels",
      method: "POST",
      path: `/apps/${currentAppId}/events`,
      desc: "Trigger a real-time event to one or more channels",
      auth: "Bearer <key> or Pusher HMAC",
      sampleBody: `{ "name": "new-message", "channels": ["chat-room"], "data": { "id": "1" } }`,
    },
    {
      category: "channels",
      method: "POST",
      path: `/apps/${currentAppId}/batch_events`,
      desc: "Trigger up to 10 events across different channels in 1 request",
      auth: "Bearer <key> or Pusher HMAC",
      sampleBody: `{ "batch": [{ "channel": "ch1", "name": "ev1", "data": {} }] }`,
    },
    {
      category: "channels",
      method: "GET",
      path: `/apps/${currentAppId}/channels`,
      desc: "List currently occupied channels and subscriber counts",
      auth: "Bearer <key> or Pusher HMAC",
      sampleBody: null,
    },
    {
      category: "channels",
      method: "GET",
      path: `/apps/${currentAppId}/channels/{name}/history?limit=50`,
      desc: "Fetch message history for late-joining clients to replay",
      auth: "Bearer <key> or Pusher HMAC",
      sampleBody: null,
    },
    {
      category: "channels",
      method: "POST",
      path: `/apps/${currentAppId}/broadcast`,
      desc: "Unified atomic broadcast: WebSocket event + Beams mobile push",
      auth: "Bearer <key> or Pusher HMAC",
      sampleBody: `{ "channel": "alerts", "event": "storm", "payload": {}, "push_notification": { "title": "Storm Alert", "body": "Stay safe", "interest": "alerts" } }`,
    },
    {
      category: "beams",
      method: "POST",
      path: `/beams/${currentInstanceId}/devices/fcm/register`,
      desc: "Register an Android or Web FCM device token",
      auth: "Public / App Token",
      sampleBody: `{ "token": "fcm_token_...", "interests": ["announcements"], "user_id": "usr_1" }`,
    },
    {
      category: "beams",
      method: "POST",
      path: `/beams/${currentInstanceId}/devices/apns/register`,
      desc: "Register an Apple iOS APNs device token",
      auth: "Public / App Token",
      sampleBody: `{ "token": "apns_hex_...", "interests": ["announcements"] }`,
    },
    {
      category: "beams",
      method: "POST",
      path: `/beams/${currentInstanceId}/publishes/interests`,
      desc: "Send push notification to all devices subscribed to a topic",
      auth: "Bearer <key>",
      sampleBody: `{ "interests": ["announcements"], "fcm": { "notification": { "title": "Update", "body": "New release!" } } }`,
    },
    {
      category: "beams",
      method: "POST",
      path: `/beams/${currentInstanceId}/publishes/users`,
      desc: "Send targeted push notification to specific authenticated user IDs",
      auth: "Bearer <key>",
      sampleBody: `{ "users": ["usr_1001"], "fcm": { "notification": { "title": "Order Ready", "body": "Pickup at counter" } } }`,
    },
    {
      category: "webhooks",
      method: "GET",
      path: `/api/apps/${currentAppId}/webhooks`,
      desc: "List active webhook callback URLs",
      auth: "Dashboard JWT",
      sampleBody: null,
    },
    {
      category: "webhooks",
      method: "POST",
      path: `/api/apps/${currentAppId}/webhooks`,
      desc: "Register a new webhook endpoint for channel & push callbacks",
      auth: "Dashboard JWT",
      sampleBody: `{ "url": "https://myapi.com/webhooks", "events": ["message_sent", "channel_occupied"] }`,
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">API Documentation & Integration</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Quickstart guides, SDK snippets, and REST API reference pre-filled with your application keys.
          </p>
        </div>

        <a
          href="/docs/openapi.yaml"
          download="aps-openapi.yaml"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-medium transition cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
          <span>Download OpenAPI Spec</span>
        </a>
      </div>

      {/* Link to Full Pusher-style Docs Portal */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 via-white to-purple-50/50 dark:from-purple-950/40 dark:via-zinc-900/60 dark:to-zinc-900 border border-purple-200 dark:border-purple-800/40 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-600/20 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-700 dark:text-purple-400 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <span>APS Dedicated Documentation Portal</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 font-medium">
                Pusher-style
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
              Browse dedicated getting-started guides for JavaScript, Android Kotlin, iOS Swift, Flutter, Laravel PHP, and Cloud Deployment.
            </p>
          </div>
        </div>
        <Link
          href="/docs"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-[#6941C6] hover:bg-[#592fa9] text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
        >
          <span>Open Docs Portal ↗</span>
        </Link>
      </div>

      {/* Pre-filled Credentials Bar */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200">Active Credentials</span>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500">App ID: {currentAppId}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between shadow-2xs">
            <div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-sans">App Key</div>
              <div className="text-slate-900 dark:text-zinc-200 font-semibold truncate max-w-[180px]">{currentAppKey}</div>
            </div>
            <button
              onClick={() => copyToClipboard(currentAppKey, "app_key")}
              className="p-1 text-slate-400 hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-300 transition cursor-pointer"
              title="Copy App Key"
            >
              {copiedKey === "app_key" ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between shadow-2xs">
            <div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-sans">App Secret</div>
              <div className="text-slate-900 dark:text-zinc-200 font-semibold truncate max-w-[180px]">••••••••••••••••</div>
            </div>
            <button
              onClick={() => copyToClipboard(currentAppSecret, "app_secret")}
              className="p-1 text-slate-400 hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-300 transition cursor-pointer"
              title="Copy App Secret"
            >
              {copiedKey === "app_secret" ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between shadow-2xs">
            <div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-sans">Beams Instance ID</div>
              <div className="text-slate-900 dark:text-zinc-200 font-semibold truncate max-w-[180px]">{currentInstanceId}</div>
            </div>
            <button
              onClick={() => copyToClipboard(currentInstanceId, "instance_id")}
              className="p-1 text-slate-400 hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-300 transition cursor-pointer"
              title="Copy Instance ID"
            >
              {copiedKey === "instance_id" ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Code Quickstart Tabs */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">SDK Quickstart</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Standard Pusher SDK integration without custom client libraries.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-zinc-950 p-1 rounded-lg border border-slate-200 dark:border-zinc-800/80 text-xs font-medium">
            {(["js", "android", "ios", "flutter", "node", "php", "python", "go", "curl"] as const).map((sdk) => (
              <button
                key={sdk}
                onClick={() => setSelectedSdk(sdk)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer text-[11px] ${
                  selectedSdk === sdk
                    ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-950 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {sdk === "js"
                  ? "Web (JS)"
                  : sdk === "android"
                  ? "Android (Kotlin)"
                  : sdk === "ios"
                  ? "iOS (Swift)"
                  : sdk === "flutter"
                  ? "Flutter"
                  : sdk === "node"
                  ? "Node.js"
                  : sdk === "php"
                  ? "PHP / Laravel"
                  : sdk === "python"
                  ? "Python"
                  : sdk === "go"
                  ? "Go"
                  : "cURL"}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Channel & Event Customization */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-zinc-200">Customize Snippet:</span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
              Personalize with your own channel & event names
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-zinc-400 text-[11px] font-mono">channel:</span>
              <input
                type="text"
                value={customChannel}
                onChange={(e) => {
                  setCustomChannel(e.target.value);
                  if (typeof window !== "undefined") {
                    localStorage.setItem(`aps_docs_channel_${appId}`, e.target.value);
                  }
                }}
                placeholder="e.g. khajumsanjog"
                className="px-2.5 py-1 text-xs rounded-md bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-[#6941C6] dark:focus:border-purple-500 w-36 shadow-2xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-zinc-400 text-[11px] font-mono">event:</span>
              <input
                type="text"
                value={customEvent}
                onChange={(e) => {
                  setCustomEvent(e.target.value);
                  if (typeof window !== "undefined") {
                    localStorage.setItem(`aps_docs_event_${appId}`, e.target.value);
                  }
                }}
                placeholder="e.g. user_joined"
                className="px-2.5 py-1 text-xs rounded-md bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-[#6941C6] dark:focus:border-purple-500 w-32 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Code Box */}
        <div className="relative rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800/80">
          <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900/60 border-b border-zinc-800/80 text-xs text-zinc-400">
            <span className="font-mono text-[11px]">
              {selectedSdk === "js"
                ? "frontend-client.js"
                : selectedSdk === "android"
                ? "RealtimeManager.kt"
                : selectedSdk === "ios"
                ? "RealtimeService.swift"
                : selectedSdk === "flutter"
                ? "realtime_service.dart"
                : selectedSdk === "node"
                ? "backend-server.js"
                : selectedSdk === "php"
                ? "trigger_event.php"
                : selectedSdk === "python"
                ? "server.py"
                : selectedSdk === "go"
                ? "main.go"
                : "terminal-curl.sh"}
            </span>
            <button
              onClick={() => copyToClipboard(sdkSnippets[selectedSdk], "active_sdk")}
              className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition text-[11px] cursor-pointer"
            >
              {copiedKey === "active_sdk" ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
            <code>{sdkSnippets[selectedSdk]}</code>
          </pre>
        </div>
      </div>

      {/* REST Endpoints Reference Explorer */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">REST API Reference</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Direct HTTP routes for events, mobile push, and management.
            </p>
          </div>

          <div className="flex gap-1.5 text-xs font-medium">
            <button
              onClick={() => setActiveCategory("channels")}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer text-xs ${
                activeCategory === "channels"
                  ? "bg-[#6941C6] text-white shadow-xs font-medium"
                  : "bg-slate-100 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-zinc-200 border border-slate-200 dark:border-zinc-800"
              }`}
            >
              Channels & Events
            </button>
            <button
              onClick={() => setActiveCategory("beams")}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer text-xs ${
                activeCategory === "beams"
                  ? "bg-[#6941C6] text-white shadow-xs font-medium"
                  : "bg-slate-100 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-zinc-200 border border-slate-200 dark:border-zinc-800"
              }`}
            >
              APS Beams (Push)
            </button>
            <button
              onClick={() => setActiveCategory("webhooks")}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer text-xs ${
                activeCategory === "webhooks"
                  ? "bg-[#6941C6] text-white shadow-xs font-medium"
                  : "bg-slate-100 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-zinc-200 border border-slate-200 dark:border-zinc-800"
              }`}
            >
              Webhooks
            </button>
          </div>
        </div>

        {/* Endpoints Table */}
        <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
          {restEndpoints
            .filter((ep) => ep.category === activeCategory)
            .map((ep, idx) => (
              <div key={idx} className="py-3.5 space-y-1.5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        ep.method === "POST"
                          ? "bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400"
                          : ep.method === "GET"
                          ? "bg-blue-100 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-400"
                          : "bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-300"
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="text-slate-900 dark:text-zinc-200 font-medium">{ep.path}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 dark:text-zinc-500 text-[11px]">Auth: {ep.auth}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          `curl -X ${ep.method} http://${currentHost}:${WS_PORT}${ep.path} -H "Authorization: Bearer ${currentAppKey}"`,
                          `ep_${idx}`
                        )
                      }
                      className="px-2 py-1 rounded bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 text-[11px] font-sans flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    >
                      {copiedKey === `ep_${idx}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>cURL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-400">{ep.desc}</p>

                {ep.sampleBody && (
                  <div className="pt-1">
                    <pre className="p-2 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-400 overflow-x-auto">
                      {ep.sampleBody}
                    </pre>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
