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
  Zap,
  Code2,
} from "lucide-react";

export default function AppOverviewPage() {
  const params = useParams();
  const appId = params.id as string;

  const [app, setApp] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"js" | "node" | "go">("js");

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
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const clientSnippet = `import Pusher from 'pusher-js';

const pusher = new Pusher('${app.app_key}', {
  wsHost: window.location.hostname || '${WS_HOST}',
  wsPort: ${WS_PORT},
  wssPort: 443,
  enabledTransports: ['ws', 'wss'],
  forceTLS: false,
  cluster: '${app.cluster}',
});

const channel = pusher.subscribe('my-channel');
channel.bind('my-event', (data) => {
  console.log('Received:', data);
});`;

  const nodeSnippet = `const Pusher = require('pusher');

const pusher = new Pusher({
  appId: '${app.id}',
  key: '${app.app_key}',
  secret: '${app.app_secret || "your-app-secret"}',
  host: '${WS_HOST}',
  port: '${WS_PORT}',
  useTLS: false,
});

pusher.trigger('my-channel', 'my-event', {
  message: 'Hello from Node.js via APS!'
});`;

  const goSnippet = `package main

import (
    "github.com/pusher/pusher-http-go/v5"
)

func main() {
    client := pusher.Client{
        AppID:  "${app.id}",
        Key:    "${app.app_key}",
        Secret: "${app.app_secret || "your-app-secret"}",
        Host:   "${WS_HOST}:${WS_PORT}",
        Secure: false,
    }

    client.Trigger("my-channel", "my-event", map[string]string{
        "message": "Hello from Go via APS!",
    })
}`;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{app.name}</h1>
          <p className="text-xs text-slate-400 mt-1">App ID: <span className="font-mono text-slate-300">{app.id}</span> · Cluster: <span className="text-blue-400 font-mono">{app.cluster}</span></p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Active & Ready</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Sockets</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white font-mono">{stats?.active_connections ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">WebSocket connections connected</div>
        </div>

        <div className="glass-panel p-5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Occupied Channels</span>
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-white font-mono">{stats?.occupied_channels ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Channels with 1+ subscribers</div>
        </div>

        <div className="glass-panel p-5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Presence Members</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-white font-mono">{stats?.presence_users ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Tracked presence user instances</div>
        </div>
      </div>

      {/* App Keys Section */}
      <div className="glass-panel p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-semibold text-white">Application Credentials</h2>
        </div>
        <p className="text-xs text-slate-400 mb-6">
          Use these credentials with official Pusher SDKs. All requests are authenticated with HMAC-SHA256.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              App ID
            </label>
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-sm font-mono text-white">
              <span>{app.id}</span>
              <button
                onClick={() => copyToClipboard(app.id, "id")}
                className="text-slate-400 hover:text-white transition"
              >
                {copiedKey === "id" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Cluster
            </label>
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-sm font-mono text-white">
              <span>{app.cluster}</span>
              <button
                onClick={() => copyToClipboard(app.cluster, "cluster")}
                className="text-slate-400 hover:text-white transition"
              >
                {copiedKey === "cluster" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              App Key
            </label>
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-sm font-mono text-white">
              <span className="truncate mr-2">{app.app_key}</span>
              <button
                onClick={() => copyToClipboard(app.app_key, "key")}
                className="text-slate-400 hover:text-white transition shrink-0"
              >
                {copiedKey === "key" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              App Secret
            </label>
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700/80 text-sm font-mono text-white">
              <span className="truncate mr-2">
                {showSecret ? app.app_secret : "••••••••••••••••••••••••"}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-slate-400 hover:text-white transition"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => copyToClipboard(app.app_secret, "sec")}
                  className="text-slate-400 hover:text-white transition"
                >
                  {copiedKey === "sec" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started Code Tabs */}
      <div className="glass-panel p-6 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Drop-in SDK Snippets</h2>
          </div>
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab("js")}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                activeTab === "js" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              pusher-js (Browser)
            </button>
            <button
              onClick={() => setActiveTab("node")}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                activeTab === "node" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Node.js
            </button>
            <button
              onClick={() => setActiveTab("go")}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                activeTab === "go" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Go SDK
            </button>
          </div>
        </div>

        <pre className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
          <code>
            {activeTab === "js" && clientSnippet}
            {activeTab === "node" && nodeSnippet}
            {activeTab === "go" && goSnippet}
          </code>
        </pre>
      </div>
    </div>
  );
}
