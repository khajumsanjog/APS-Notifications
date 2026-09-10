"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchWithAuth, WS_HOST, WS_PORT } from "@/lib/api";
import {
  Code,
  Copy,
  Check,
  Terminal,
  Download,
} from "lucide-react";

export default function AppDocsPage() {
  const params = useParams();
  const appId = params.id as string;

  const [app, setApp] = useState<any>(null);
  const [beamsInstance, setBeamsInstance] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedSdk, setSelectedSdk] = useState<"js" | "node" | "python" | "go" | "curl">("js");
  const [activeCategory, setActiveCategory] = useState<"channels" | "beams" | "webhooks">("channels");

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

const channel = pusher.subscribe('chat-room');
channel.bind('new-message', (data) => {
  console.log('Real-time event received:', data);
});`,

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

pusher.trigger('chat-room', 'new-message', {
  author: 'Alice',
  text: 'Hello from Node.js server',
  timestamp: Date.now()
});`,

    python: `# Install Pusher Python SDK:
# pip install pusher

from pusher import Pusher

pusher_client = Pusher(
    app_id='${currentAppId}',
    key='${currentAppKey}',
    secret='${currentAppSecret}',
    host='${currentHost}',
    port=${WS_PORT},
    ssl=False
)

pusher_client.trigger('chat-room', 'new-message', {
    'author': 'Alice',
    'text': 'Hello from Python server'
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
		"name":     "new-message",
		"channels": []string{"chat-room"},
		"data": map[string]any{
			"author": "Alice",
			"text":   "Hello from Go service",
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
    "name": "new-message",
    "channels": ["chat-room"],
    "data": {
      "author": "Alice",
      "text": "Hello from cURL"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">API Documentation & Integration</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Quickstart guides, SDK snippets, and REST API reference pre-filled with your application keys.
          </p>
        </div>

        <a
          href="/docs/openapi.yaml"
          download="aps-openapi.yaml"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-medium transition cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-zinc-400" />
          <span>Download OpenAPI Spec</span>
        </a>
      </div>

      {/* Pre-filled Credentials Bar */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-200">Active Credentials</span>
          <span className="text-[11px] font-mono text-zinc-500">App ID: {currentAppId}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono text-xs">
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-zinc-500 font-sans">App Key</div>
              <div className="text-zinc-200 truncate max-w-[180px]">{currentAppKey}</div>
            </div>
            <button
              onClick={() => copyToClipboard(currentAppKey, "app_key")}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
              title="Copy App Key"
            >
              {copiedKey === "app_key" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-zinc-500 font-sans">App Secret</div>
              <div className="text-zinc-200 truncate max-w-[180px]">••••••••••••••••</div>
            </div>
            <button
              onClick={() => copyToClipboard(currentAppSecret, "app_secret")}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
              title="Copy App Secret"
            >
              {copiedKey === "app_secret" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-zinc-500 font-sans">Beams Instance ID</div>
              <div className="text-zinc-200 truncate max-w-[180px]">{currentInstanceId}</div>
            </div>
            <button
              onClick={() => copyToClipboard(currentInstanceId, "instance_id")}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
              title="Copy Instance ID"
            >
              {copiedKey === "instance_id" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Code Quickstart Tabs */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">SDK Quickstart</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Standard Pusher SDK integration without custom client libraries.
            </p>
          </div>

          <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800/80 text-xs font-medium">
            {(["js", "node", "python", "go", "curl"] as const).map((sdk) => (
              <button
                key={sdk}
                onClick={() => setSelectedSdk(sdk)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer text-[11px] ${
                  selectedSdk === sdk
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {sdk === "js" ? "Web (JS)" : sdk === "node" ? "Node.js" : sdk}
              </button>
            ))}
          </div>
        </div>

        {/* Code Box */}
        <div className="relative rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800/80">
          <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900/60 border-b border-zinc-800/80 text-xs text-zinc-400">
            <span className="font-mono text-[11px]">
              {selectedSdk === "js"
                ? "frontend-client.js"
                : selectedSdk === "node"
                ? "backend-server.js"
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
      <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">REST API Reference</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Direct HTTP routes for events, mobile push, and management.
            </p>
          </div>

          <div className="flex gap-1.5 text-xs font-medium">
            <button
              onClick={() => setActiveCategory("channels")}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer text-xs ${
                activeCategory === "channels"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              Channels & Events
            </button>
            <button
              onClick={() => setActiveCategory("beams")}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer text-xs ${
                activeCategory === "beams"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              APS Beams (Push)
            </button>
            <button
              onClick={() => setActiveCategory("webhooks")}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer text-xs ${
                activeCategory === "webhooks"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              Webhooks
            </button>
          </div>
        </div>

        {/* Endpoints Table */}
        <div className="divide-y divide-zinc-800/80">
          {restEndpoints
            .filter((ep) => ep.category === activeCategory)
            .map((ep, idx) => (
              <div key={idx} className="py-3.5 space-y-1.5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        ep.method === "POST"
                          ? "bg-emerald-950/50 border border-emerald-900/50 text-emerald-400"
                          : ep.method === "GET"
                          ? "bg-blue-950/50 border border-blue-900/50 text-blue-400"
                          : "bg-zinc-850 text-zinc-300"
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="text-zinc-200">{ep.path}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-500 text-[11px]">Auth: {ep.auth}</span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          `curl -X ${ep.method} http://${currentHost}:${WS_PORT}${ep.path} -H "Authorization: Bearer ${currentAppKey}"`,
                          `ep_${idx}`
                        )
                      }
                      className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-sans flex items-center gap-1 transition cursor-pointer"
                    >
                      {copiedKey === `ep_${idx}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copied</span>
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

                <p className="text-xs text-zinc-400">{ep.desc}</p>

                {ep.sampleBody && (
                  <div className="pt-1">
                    <pre className="p-2 rounded bg-zinc-950 border border-zinc-850 text-[11px] font-mono text-zinc-400 overflow-x-auto">
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
