"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchWithAuth, WS_HOST, WS_PORT } from "@/lib/api";
import {
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Activity,
  Users,
  Radio,
  Code2,
} from "lucide-react";

export default function AppOverviewPage() {
  const params = useParams();
  const appId = params.id as string;

  const [app, setApp] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"js" | "android" | "ios" | "flutter" | "node" | "php" | "python" | "go" | "curl">("js");

  useEffect(() => {
    if (!appId) return;

    loadAppData();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, [appId]);

  const loadAppData = async () => {
    try {
      const res = await fetchWithAuth(`/api/apps/${appId}`);
      if (res.ok) {
        const data = await res.json();
        setApp(data.app);
      }
    } catch (err) {
      console.error(err);
    }
    loadStats();
  };

  const loadStats = async () => {
    try {
      const res = await fetchWithAuth(`/api/apps/${appId}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
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

  if (!app) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin"></div>
      </div>
    );
  }

  const host = typeof window !== "undefined" ? window.location.hostname : WS_HOST;

  const snippets = {
    js: `import Pusher from 'pusher-js';

const pusher = new Pusher('${app.app_key}', {
  wsHost: '${host}',
  wsPort: ${WS_PORT},
  wssPort: 443,
  enabledTransports: ['ws', 'wss'],
  forceTLS: false,
  cluster: '${app.cluster}',
});

const channel = pusher.subscribe('chat-room');
channel.bind('new-message', (data) => {
  console.log('Received real-time event:', data);
});`,

    android: `// 1. In build.gradle.kts: implementation("com.pusher:pusher-java-client:2.4.4")
val options = PusherOptions().apply {
  setCluster('${app.cluster}')
  setHost('${host}')
  setWsPort(${WS_PORT})
  setWssPort(443)
  isUseTLS = false
}

val pusher = Pusher('${app.app_key}', options)
pusher.connect()

val channel = pusher.subscribe('chat-room')
channel.bind('new-message') { event ->
  Log.d("APS", "Event data: \${event.data}")
}`,

    ios: `// Swift Package Manager: https://github.com/pusher/pusher-websocket-swift
import PusherSwift

let options = PusherClientOptions(
  host: .host("${host}"),
  port: ${WS_PORT},
  useTLS: false,
  cluster: "${app.cluster}"
)
let pusher = Pusher(key: "${app.app_key}", options: options)
let channel = pusher.subscribe("chat-room")
let _ = channel.bind(eventName: "new-message") { event in
  print("Received event: \\(event.data ?? "")")
}
pusher.connect()`,

    flutter: `// pubspec.yaml: pusher_channels_flutter: ^2.2.1
import 'package:pusher_channels_flutter/pusher_channels_flutter.dart';

final pusher = PusherChannelsFlutter.getInstance();
await pusher.init(
  apiKey: "${app.app_key}",
  cluster: "${app.cluster}",
  host: "${host}",
  wsPort: ${WS_PORT},
  useTLS: false,
  onEvent: (event) => print("Event: \${event.data}"),
);
await pusher.subscribe(channelName: "chat-room");
await pusher.connect();`,

    node: `const Pusher = require('pusher');

const pusher = new Pusher({
  appId: '${app.id}',
  key: '${app.app_key}',
  secret: '${app.app_secret || "your-app-secret"}',
  host: '${host}',
  port: '${WS_PORT}',
  useTLS: false,
});

pusher.trigger('chat-room', 'new-message', {
  message: 'Hello world from Node.js via APS!',
  timestamp: Date.now()
});`,

    php: `<?php
// composer require pusher/pusher-php-server
require __DIR__ . '/vendor/autoload.php';

$pusher = new Pusher\\Pusher('${app.app_key}', '${app.app_secret || "your-app-secret"}', '${app.id}', [
  'cluster' => '${app.cluster}',
  'host' => '${host}',
  'port' => ${WS_PORT},
  'scheme' => 'http',
  'useTLS' => false
]);

$pusher->trigger('chat-room', 'new-message', [
  'author' => 'Alice',
  'text' => 'Hello from PHP via APS!'
]);`,

    python: `from pusher import Pusher

pusher_client = Pusher(
    app_id='${app.id}',
    key='${app.app_key}',
    secret='${app.app_secret || "your-app-secret"}',
    host='${host}',
    port=${WS_PORT},
    ssl=False
)

pusher_client.trigger('chat-room', 'new-message', {
    'message': 'Hello from Python via APS!'
})`,

    go: `package main

import (
    "github.com/pusher/pusher-http-go/v5"
)

func main() {
    client := pusher.Client{
        AppID:  "${app.id}",
        Key:    "${app.app_key}",
        Secret: "${app.app_secret || "your-app-secret"}",
        Host:   "${host}:${WS_PORT}",
        Secure: false,
    }

    client.Trigger("chat-room", "new-message", map[string]any{
        "message": "Hello from Go via APS!",
    })
}`,

    curl: `curl -X POST http://${host}:${WS_PORT}/apps/${app.id}/events \\
  -H "Authorization: Bearer ${app.app_key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "new-message",
    "channel": "chat-room",
    "data": "{\\"text\\": \\"Hello from cURL via APS\\"}"
  }'`,
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">{app.name}</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-mono">
            App ID: <span className="text-slate-700 dark:text-zinc-300 font-semibold">{app.id}</span> · Cluster: <span className="text-slate-700 dark:text-zinc-300 font-semibold">{app.cluster}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Active</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1.5">
            <span className="text-xs font-medium">Active Sockets</span>
            <Activity className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 font-mono tracking-tight">
            {stats?.active_connections ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Live WebSocket connections</div>
        </div>

        <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1.5">
            <span className="text-xs font-medium">Occupied Channels</span>
            <Radio className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 font-mono tracking-tight">
            {stats?.occupied_channels ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Channels with active listeners</div>
        </div>

        <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-4 rounded-xl">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-1.5">
            <span className="text-xs font-medium">Presence Users</span>
            <Users className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 font-mono tracking-tight">
            {stats?.presence_users ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Online presence members</div>
        </div>
      </div>

      {/* Credentials Card */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-5 rounded-xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">API Credentials</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Use these keys with official Pusher client and server libraries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
              App ID
            </label>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-800 dark:text-zinc-200">
              <span>{app.id}</span>
              <button
                onClick={() => copyToClipboard(app.id, "id")}
                className="text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition cursor-pointer p-0.5"
                title="Copy App ID"
              >
                {copiedKey === "id" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
              Cluster Region
            </label>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-800 dark:text-zinc-200">
              <span>{app.cluster}</span>
              <button
                onClick={() => copyToClipboard(app.cluster, "cluster")}
                className="text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition cursor-pointer p-0.5"
                title="Copy Cluster"
              >
                {copiedKey === "cluster" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
              App Key (Public)
            </label>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-800 dark:text-zinc-200">
              <span className="truncate mr-2">{app.app_key}</span>
              <button
                onClick={() => copyToClipboard(app.app_key, "key")}
                className="text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition cursor-pointer shrink-0 p-0.5"
                title="Copy App Key"
              >
                {copiedKey === "key" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
              App Secret (Private)
            </label>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-800 dark:text-zinc-200">
              <span className="truncate mr-2">
                {showSecret ? app.app_secret : "••••••••••••••••••••••••"}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition cursor-pointer p-0.5"
                  title={showSecret ? "Hide secret" : "Show secret"}
                >
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => copyToClipboard(app.app_secret, "sec")}
                  className="text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition cursor-pointer p-0.5"
                  title="Copy App Secret"
                >
                  {copiedKey === "sec" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Code Snippets Section */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-5 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">SDK Quickstart</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Copy-paste drop-in snippets pre-configured with your active credentials.
            </p>
          </div>
          <button
            onClick={() => copyToClipboard(snippets[activeTab], "snippet")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-medium transition cursor-pointer"
          >
            {copiedKey === "snippet" ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 w-fit text-xs font-medium">
          {(["js", "android", "ios", "flutter", "node", "php", "python", "go", "curl"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${
                activeTab === tab
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              {tab === "js"
                ? "JavaScript (Browser)"
                : tab === "android"
                ? "Android (Kotlin)"
                : tab === "ios"
                ? "iOS (Swift)"
                : tab === "flutter"
                ? "Flutter"
                : tab === "node"
                ? "Node.js"
                : tab === "php"
                ? "PHP / Laravel"
                : tab === "python"
                ? "Python"
                : tab === "go"
                ? "Go"
                : "cURL"}
            </button>
          ))}
        </div>

        {/* Code Box */}
        <pre className="p-4 rounded-lg bg-[#0d1117] border border-slate-800 dark:border-zinc-800 text-xs font-mono text-gray-100 overflow-x-auto leading-relaxed shadow-xs">
          <code>{snippets[activeTab]}</code>
        </pre>
      </div>
    </div>
  );
}
