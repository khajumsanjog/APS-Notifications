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
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">Live Debug Console</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Inspect real-time WebSocket traffic and emit test events directly to your channels.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono">
            {status === "connected" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-zinc-200">connected</span>
                <span className="text-zinc-500">({socketId})</span>
              </>
            ) : status === "connecting" ? (
              <>
                <div className="w-2 h-2 border border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
                <span className="text-zinc-400">connecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-red-400" />
                <button onClick={connectWebSocket} className="text-red-400 hover:text-red-300 transition cursor-pointer">
                  reconnect
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setLogs([])}
            className="p-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Controls Column */}
        <div className="space-y-4">
          {/* Subscribe Panel */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-xl space-y-3">
            <h3 className="text-xs font-medium text-zinc-300">
              Subscribe to Channel
            </h3>
            <form onSubmit={handleSubscribeSubmit} className="flex gap-2">
              <input
                type="text"
                value={subscribedChannel}
                onChange={(e) => setSubscribedChannel(e.target.value)}
                placeholder="channel-name"
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition cursor-pointer"
              >
                Join
              </button>
            </form>

            <div className="flex flex-wrap gap-1">
              {activeChannels.map((ch) => (
                <span
                  key={ch}
                  className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800/80 text-[11px] font-mono text-zinc-400"
                >
                  #{ch}
                </span>
              ))}
            </div>
          </div>

          {/* Emit Event Form */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-xl space-y-3">
            <h3 className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-zinc-400" />
              <span>Emit Test Event (REST)</span>
            </h3>

            <form onSubmit={handleTriggerSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Target Channel</label>
                <input
                  type="text"
                  required
                  value={triggerChannel}
                  onChange={(e) => setTriggerChannel(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Data Payload (JSON)</label>
                <textarea
                  rows={4}
                  required
                  value={triggerPayload}
                  onChange={(e) => setTriggerPayload(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-2 px-3 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                <span>{sending ? "Emitting..." : "Trigger Event"}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Live Stream Column */}
        <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col h-[580px] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">
              Event Stream ({logs.length})
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>listening</span>
            </div>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-2 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                <Terminal className="w-6 h-6 mb-2 opacity-40" />
                <p className="text-xs">Waiting for events...</p>
                <p className="text-[11px] mt-1 text-zinc-600">Events published to subscribed channels appear here.</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 space-y-1.5 hover:border-zinc-700/80 transition"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      {log.type === "in" ? (
                        <span className="flex items-center gap-0.5 text-emerald-400 font-medium">
                          <ArrowDownLeft className="w-3 h-3" /> RECV
                        </span>
                      ) : log.type === "out" ? (
                        <span className="flex items-center gap-0.5 text-blue-400 font-medium">
                          <ArrowUpRight className="w-3 h-3" /> SENT
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium">INFO</span>
                      )}

                      {log.channel && (
                        <span className="px-1.5 py-0.2 rounded bg-zinc-850 text-zinc-400">
                          #{log.channel}
                        </span>
                      )}
                      <span className="text-zinc-200 font-medium">{log.event}</span>
                    </div>

                    <div className="flex items-center gap-1 text-zinc-500 text-[10px]">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{log.timestamp}</span>
                    </div>
                  </div>

                  <pre className="text-[11px] text-zinc-400 overflow-x-auto bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
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
