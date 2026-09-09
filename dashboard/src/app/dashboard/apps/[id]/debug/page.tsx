"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { fetchWithAuth, WS_HOST, WS_PORT } from "@/lib/api";
import {
  Terminal,
  Play,
  Trash2,
  Radio,
  Send,
  Wifi,
  WifiOff,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  type: "in" | "out" | "info";
  channel?: string;
  event: string;
  data: any;
}

export default function DebugConsolePage() {
  const params = useParams();
  const appId = params.id as string;

  const [app, setApp] = useState<any>(null);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [socketId, setSocketId] = useState<string>("");
  const [subscribedChannel, setSubscribedChannel] = useState("my-channel");
  const [activeChannels, setActiveChannels] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Trigger testbed state
  const [triggerChannel, setTriggerChannel] = useState("my-channel");
  const [triggerEvent, setTriggerEvent] = useState("test_event");
  const [triggerPayload, setTriggerPayload] = useState('{\n  "message": "Hello from APS Console",\n  "timestamp": ' + Date.now() + '\n}');
  const [sending, setSending] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchWithAuth(`/api/apps/${appId}`)
      .then((res) => res.json())
      .then((data) => {
        setApp(data.app);
      });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [appId]);

  useEffect(() => {
    if (app?.app_key) {
      connectWebSocket();
    }
  }, [app]);

  const connectWebSocket = () => {
    if (!app?.app_key) return;

    setStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || WS_HOST;
    const wsUrl = `${protocol}//${host}:${WS_PORT}/app/${app.app_key}?protocol=7&client=js&version=8.4.0`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      addLog("info", "", "connection:opening", { url: wsUrl });
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const { event: evName, channel, data } = parsed;

        let parsedData = data;
        if (typeof data === "string") {
          try {
            parsedData = JSON.parse(data);
          } catch {
            parsedData = data;
          }
        }

        if (evName === "pusher:connection_established") {
          setStatus("connected");
          setSocketId(parsedData?.socket_id || "");
          addLog("in", "", evName, parsedData);

          // Auto subscribe to default channel
          subscribeToChannel(ws, subscribedChannel);
          return;
        }

        if (evName === "pusher:ping") {
          ws.send(JSON.stringify({ event: "pusher:pong", data: "{}" }));
          return;
        }

        addLog("in", channel || "", evName, parsedData);
      } catch (e) {
        addLog("in", "", "raw_message", event.data);
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      addLog("info", "", "connection:closed", { status: "disconnected" });
    };

    ws.onerror = (err) => {
      addLog("info", "", "connection:error", { error: "WebSocket error" });
    };
  };

  const subscribeToChannel = (wsInstance: WebSocket | null, ch: string) => {
    if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN) return;

    const subMsg = {
      event: "pusher:subscribe",
      data: {
        channel: ch,
      },
    };
    wsInstance.send(JSON.stringify(subMsg));
    addLog("out", ch, "pusher:subscribe", { channel: ch });
    setActiveChannels((prev) => (prev.includes(ch) ? prev : [...prev, ch]));
  };

  const addLog = (type: "in" | "out" | "info", channel: string, event: string, data: any) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      type,
      channel,
      event,
      data,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 99)]);
  };

  const handleSubscribeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscribedChannel.trim()) return;
    subscribeToChannel(wsRef.current, subscribedChannel);
  };

  const handleTriggerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      let parsedPayload: any;
      try {
        parsedPayload = JSON.parse(triggerPayload);
      } catch {
        parsedPayload = triggerPayload;
      }

      const res = await fetchWithAuth(`/apps/${appId}/events`, {
        method: "POST",
        body: JSON.stringify({
          name: triggerEvent,
          channels: [triggerChannel],
          data: parsedPayload,
        }),
      });

      if (res.ok) {
        addLog("out", triggerChannel, triggerEvent, parsedPayload);
      }
    } catch (err) {
      console.error("Failed to trigger event", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Terminal className="w-6 h-6 text-blue-400" />
            Live Debug Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time event stream and interactive event emitter testbed.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            {status === "connected" ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Connected</span>
                <span className="text-slate-500 font-mono">({socketId})</span>
              </>
            ) : status === "connecting" ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-amber-400">Connecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
                <button onClick={connectWebSocket} className="text-red-400 hover:underline">
                  Reconnect
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setLogs([])}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Clear Logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Controls & Trigger */}
        <div className="space-y-6">
          {/* Subscribe to Channel Panel */}
          <div className="glass-panel p-5 rounded-xl shadow-lg">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Subscribe to Channel
            </h3>
            <form onSubmit={handleSubscribeSubmit} className="flex gap-2">
              <input
                type="text"
                value={subscribedChannel}
                onChange={(e) => setSubscribedChannel(e.target.value)}
                placeholder="channel-name"
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition flex items-center gap-1"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Join</span>
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {activeChannels.map((ch) => (
                <span
                  key={ch}
                  className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[11px] font-mono text-blue-300"
                >
                  #{ch}
                </span>
              ))}
            </div>
          </div>

          {/* Trigger Event Testbed */}
          <div className="glass-panel p-5 rounded-xl shadow-lg">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-blue-400" />
              Emit Test Event (REST)
            </h3>

            <form onSubmit={handleTriggerSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Target Channel</label>
                <input
                  type="text"
                  required
                  value={triggerChannel}
                  onChange={(e) => setTriggerChannel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Data Payload (JSON)</label>
                <textarea
                  rows={4}
                  required
                  value={triggerPayload}
                  onChange={(e) => setTriggerPayload(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium text-white text-xs shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{sending ? "Emitting..." : "Trigger Event"}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Event Stream Log */}
        <div className="lg:col-span-2 glass-panel rounded-xl flex flex-col h-[650px] shadow-lg overflow-hidden border border-slate-800">
          <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Live Event Stream ({logs.length})
            </span>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Real-time</span>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Terminal className="w-8 h-8 mb-2 opacity-50" />
                <p>Waiting for channel events...</p>
                <p className="text-[11px] mt-1 text-slate-600">Trigger an event to see it appear here live.</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 space-y-1 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      {log.type === "in" ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <ArrowDownLeft className="w-3 h-3" /> RECV
                        </span>
                      ) : log.type === "out" ? (
                        <span className="flex items-center gap-1 text-blue-400 font-bold">
                          <ArrowUpRight className="w-3 h-3" /> SENT
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold">INFO</span>
                      )}

                      {log.channel && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          #{log.channel}
                        </span>
                      )}
                      <span className="text-white font-semibold">{log.event}</span>
                    </div>

                    <div className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{log.timestamp}</span>
                    </div>
                  </div>

                  <pre className="text-[11px] text-slate-300 overflow-x-auto bg-slate-950/60 p-2 rounded mt-1 border border-slate-900">
                    <code>{JSON.stringify(log.data, null, 2)}</code>
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
