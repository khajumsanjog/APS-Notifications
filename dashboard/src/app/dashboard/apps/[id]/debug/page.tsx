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
  X,
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

  // Dynamic user channels persisted in localStorage per app
  const [activeChannels, setActiveChannels] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`aps_channels_${appId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return ["my-channel"];
  });

  const activeChannelsRef = useRef<string[]>(activeChannels);
  useEffect(() => {
    activeChannelsRef.current = activeChannels;
    if (typeof window !== "undefined") {
      localStorage.setItem(`aps_channels_${appId}`, JSON.stringify(activeChannels));
    }
  }, [activeChannels, appId]);

  const [subscribedChannel, setSubscribedChannel] = useState("");

  // Persistent log storage across page refreshes via localStorage & sessionStorage
  const [logs, setLogs] = useState<LogEntry[]>([]);
  // Default to "events" so recent application messages are always shown at the top
  const [streamFilter, setStreamFilter] = useState<"all" | "events" | "system">("events");
  const [compactHandshakes, setCompactHandshakes] = useState<boolean>(true);
  const streamContainerRef = useRef<HTMLDivElement | null>(null);

  const isSystemEvent = (ev: string) =>
    ev.startsWith("pusher:") ||
    ev.startsWith("pusher_internal:") ||
    ev.startsWith("connection:");

  // Load cached logs as soon as appId is ready
  useEffect(() => {
    if (!appId || typeof window === "undefined") return;
    try {
      const cached = localStorage.getItem(`aps_debug_logs_${appId}`) || sessionStorage.getItem(`aps_debug_logs_${appId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLogs(parsed);
        }
      }
    } catch {}
  }, [appId]);

  // Sync logs to localStorage & sessionStorage - only persist application events across refreshes
  useEffect(() => {
    if (!appId || typeof window === "undefined" || logs.length === 0) return;
    try {
      const appEventsOnly = logs.filter((l) => !isSystemEvent(l.event));
      localStorage.setItem(`aps_debug_logs_${appId}`, JSON.stringify(appEventsOnly.slice(0, 100)));
      sessionStorage.setItem(`aps_debug_logs_${appId}`, JSON.stringify(appEventsOnly.slice(0, 100)));
    } catch {}
  }, [logs, appId]);

  const handleClearLogs = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`aps_debug_logs_${appId}`);
      sessionStorage.removeItem(`aps_debug_logs_${appId}`);
    }
    setLogs([]);
  };

  // Trigger testbed state
  const [triggerChannel, setTriggerChannel] = useState(() => activeChannels[0] || "my-channel");
  const [triggerEvent, setTriggerEvent] = useState("my-event");
  const [triggerPayload, setTriggerPayload] = useState('{\n  "message": "Hello from APS Console",\n  "timestamp": ' + Date.now() + '\n}');
  const [sending, setSending] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchWithAuth(`/api/apps/${appId}`)
      .then((res) => res.json())
      .then((data) => {
        setApp(data.app);
      });

    // Pre-populate with recent history from database so events persist across page refresh
    fetchWithAuth(`/api/apps/${appId}/history`)
      .then((res) => (res.ok ? res.json() : []))
      .then((history: any[]) => {
        if (Array.isArray(history) && history.length > 0) {
          const initialLogs: LogEntry[] = history
            .slice()
            .reverse() // Newest first
            .map((item) => {
              let parsedData = item.payload;
              try {
                parsedData = JSON.parse(item.payload);
              } catch {}
              return {
                id: `hist_${item.id || Math.random().toString(36).substring(7)}`,
                timestamp: item.created_at ? new Date(item.created_at).toLocaleTimeString() : new Date().toLocaleTimeString(),
                type: "in",
                channel: item.channel_name || "",
                event: item.event_name || "",
                data: parsedData,
              };
            });

          setLogs((prev) => {
            const existingKeys = new Set(
              prev.map((l) => `${l.channel}:${l.event}:${typeof l.data === "string" ? l.data : JSON.stringify(l.data)}`)
            );
            const newEntries = initialLogs.filter(
              (l) => !existingKeys.has(`${l.channel}:${l.event}:${typeof l.data === "string" ? l.data : JSON.stringify(l.data)}`)
            );
            return [...newEntries, ...prev].slice(0, 100);
          });
        }
      })
      .catch(() => {});

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
          // Subscribe to wildcard so ANY channel triggered across this app is received live!
          subscribeToChannel(ws, "*");
          // Subscribe to all channels the user has configured
          activeChannelsRef.current.forEach((ch) => {
            subscribeToChannel(ws, ch);
          });
          return;
        }

        if (evName === "pusher:ping") {
          ws.send(JSON.stringify({ event: "pusher:pong", data: "{}" }));
          return;
        }

        if (evName === "pusher_internal:subscription_succeeded" && channel === "*") {
          return; // silent internal wildcard subscription ack
        }

        // If an event arrives on a channel not yet in activeChannels (e.g. from Python sender), dynamically track it
        if (channel && channel !== "*" && !activeChannelsRef.current.includes(channel)) {
          setActiveChannels((prev) => {
            if (!prev.includes(channel)) return [...prev, channel];
            return prev;
          });
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
    if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN || !ch.trim()) return;

    const subMsg = {
      event: "pusher:subscribe",
      data: {
        channel: ch,
      },
    };
    wsInstance.send(JSON.stringify(subMsg));
    if (ch !== "*") {
      addLog("out", ch, "pusher:subscribe", { channel: ch });
    }
  };

  const handleSubscribeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ch = subscribedChannel.trim();
    if (!ch) return;
    if (!activeChannels.includes(ch)) {
      setActiveChannels((prev) => [...prev, ch]);
    }
    subscribeToChannel(wsRef.current, ch);
    setTriggerChannel(ch);
    setSubscribedChannel("");
  };

  const handleUnsubscribe = (ch: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          event: "pusher:unsubscribe",
          data: { channel: ch },
        })
      );
      addLog("out", ch, "pusher:unsubscribe", { channel: ch });
    }
    setActiveChannels((prev) => prev.filter((c) => c !== ch));
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
    if (streamContainerRef.current) {
      streamContainerRef.current.scrollTop = 0;
    }
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
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Live Debug Console</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Inspect real-time WebSocket traffic and emit test events directly to your channels.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-mono">
            {status === "connected" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-800 dark:text-zinc-200">connected</span>
                <span className="text-slate-500 dark:text-zinc-500">({socketId})</span>
              </>
            ) : status === "connecting" ? (
              <>
                <div className="w-2 h-2 border border-slate-400 dark:border-zinc-500 border-t-slate-800 dark:border-t-zinc-200 rounded-full animate-spin" />
                <span className="text-slate-500 dark:text-zinc-400">connecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-red-500" />
                <button onClick={connectWebSocket} className="text-red-500 hover:text-red-600 transition cursor-pointer">
                  reconnect
                </button>
              </>
            )}
          </div>

          <button
            onClick={handleClearLogs}
            className="p-1.5 rounded-md bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 shadow-xs transition cursor-pointer"
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
          <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-zinc-300">
                Subscribe to Channel
              </h3>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                {activeChannels.length} active
              </span>
            </div>
            <form onSubmit={handleSubscribeSubmit} className="flex gap-2">
              <input
                type="text"
                value={subscribedChannel}
                onChange={(e) => setSubscribedChannel(e.target.value)}
                placeholder="Custom channel (e.g. khajumsanjog)..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#6941C6] dark:focus:border-zinc-500 transition font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-[#6941C6] hover:bg-[#592fa9] text-xs font-medium text-white transition cursor-pointer shadow-xs shrink-0"
              >
                Join
              </button>
            </form>

            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium uppercase tracking-wider">
                Active Channel Subscriptions
              </div>
              {activeChannels.length === 0 ? (
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic">
                  No active channels. Enter any custom channel name above to listen in real-time.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeChannels.map((ch) => (
                    <div
                      key={ch}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-[11px] font-mono text-purple-900 dark:text-purple-300"
                    >
                      <button
                        type="button"
                        onClick={() => setTriggerChannel(ch)}
                        title="Click to select for emitting events"
                        className="cursor-pointer hover:underline"
                      >
                        #{ch}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnsubscribe(ch)}
                        title={`Leave #${ch}`}
                        className="text-purple-400 hover:text-red-500 transition cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Emit Event Form */}
          <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-4 rounded-xl space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-zinc-300 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <span>Emit Test Event (REST)</span>
            </h3>

            <form onSubmit={handleTriggerSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">Target Channel</label>
                <input
                  type="text"
                  required
                  value={triggerChannel}
                  onChange={(e) => setTriggerChannel(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-purple-600 dark:focus:border-zinc-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-purple-600 dark:focus:border-zinc-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">Data Payload (JSON)</label>
                <textarea
                  rows={4}
                  required
                  value={triggerPayload}
                  onChange={(e) => setTriggerPayload(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-purple-600 dark:focus:border-zinc-500 transition leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-2 px-3 rounded-lg bg-[#6941C6] hover:bg-[#592fa9] dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                <span>{sending ? "Emitting..." : "Trigger Event"}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Live Stream Column */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs rounded-xl flex flex-col h-[620px] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-900/60 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-zinc-300">
                Event Stream
              </span>

              {/* Filter Pills */}
              <div className="flex items-center bg-slate-200/70 dark:bg-zinc-800/80 p-0.5 rounded-lg text-[10px]">
                <button
                  type="button"
                  onClick={() => setStreamFilter("all")}
                  className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                    streamFilter === "all"
                      ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  All ({logs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStreamFilter("events")}
                  className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                    streamFilter === "events"
                      ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                      : "text-slate-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                  }`}
                >
                  Events Only ({logs.filter((l) => !l.event.startsWith("pusher:") && !l.event.startsWith("pusher_internal:") && !l.event.startsWith("connection:")).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStreamFilter("system")}
                  className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                    streamFilter === "system"
                      ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  System ({logs.filter((l) => l.event.startsWith("pusher:") || l.event.startsWith("pusher_internal:") || l.event.startsWith("connection:")).length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={compactHandshakes}
                  onChange={(e) => setCompactHandshakes(e.target.checked)}
                  className="rounded border-slate-300 dark:border-zinc-700 text-[#6941C6] focus:ring-0 w-3 h-3 cursor-pointer"
                />
                <span>Compact Handshakes</span>
              </label>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-500 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>listening</span>
              </div>
            </div>
          </div>

          <div ref={streamContainerRef} className="flex-1 p-3 overflow-y-auto space-y-2 font-mono text-xs bg-slate-50/40 dark:bg-transparent scroll-smooth">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500">
                <Terminal className="w-6 h-6 mb-2 opacity-40" />
                <p className="text-xs">Waiting for events...</p>
                <p className="text-[11px] mt-1 text-slate-400 dark:text-zinc-600">Events published to subscribed channels appear here.</p>
              </div>
            ) : (
              logs
                .filter((log) => {
                  const isSys =
                    log.event.startsWith("pusher:") ||
                    log.event.startsWith("pusher_internal:") ||
                    log.event.startsWith("connection:");
                  if (streamFilter === "events") return !isSys;
                  if (streamFilter === "system") return isSys;
                  return true;
                })
                .map((log, index) => {
                  const isSys =
                    log.event.startsWith("pusher:") ||
                    log.event.startsWith("pusher_internal:") ||
                    log.event.startsWith("connection:");

                  if (isSys && compactHandshakes) {
                    return (
                      <div
                        key={log.id}
                        className="px-2.5 py-1 rounded-md bg-slate-100/70 dark:bg-zinc-900/40 border border-slate-200/70 dark:border-zinc-800/50 text-[10px] flex items-center justify-between text-slate-500 dark:text-zinc-400 font-mono"
                      >
                        <div className="flex items-center gap-1.5 truncate pr-2">
                          <span className="text-slate-400 dark:text-zinc-500">⚡</span>
                          {log.event === "pusher:connection_established" ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate">
                              Connected to APS (socket: {log.data?.socket_id || "active"})
                            </span>
                          ) : log.event === "pusher:subscribe" ? (
                            <span className="truncate">
                              Subscribe request → <strong className="text-slate-700 dark:text-zinc-300">#{log.channel}</strong>
                            </span>
                          ) : log.event === "pusher_internal:subscription_succeeded" ? (
                            <span className="text-emerald-600 dark:text-emerald-400 truncate">
                              Subscribed ✓ <strong className="text-slate-700 dark:text-zinc-300">#{log.channel}</strong>
                            </span>
                          ) : (
                            <span className="truncate">{log.event} {log.channel ? `(#${log.channel})` : ""}</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">{log.timestamp}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg bg-white dark:bg-zinc-950/70 border border-slate-200 dark:border-zinc-800/80 shadow-xs space-y-1.5 hover:border-slate-300 dark:hover:border-zinc-700/80 transition"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          {log.type === "in" ? (
                            <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                              <ArrowDownLeft className="w-3 h-3" /> RECV
                            </span>
                          ) : log.type === "out" ? (
                            <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-medium">
                              <ArrowUpRight className="w-3 h-3" /> SENT
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">INFO</span>
                          )}

                          {log.channel && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 font-mono text-[10px]">
                              #{log.channel}
                            </span>
                          )}
                          <span className="text-slate-900 dark:text-zinc-200 font-medium">{log.event}</span>

                          {index === 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-100 dark:bg-purple-950 text-[#6941C6] dark:text-purple-300 border border-purple-200 dark:border-purple-800 tracking-wide">
                              RECENT
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-slate-400 dark:text-zinc-500 text-[10px]">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{log.timestamp}</span>
                        </div>
                      </div>

                      <pre className="text-[11px] text-slate-800 dark:text-zinc-400 overflow-x-auto bg-slate-100 dark:bg-zinc-900/60 p-2 rounded border border-slate-200 dark:border-zinc-800/60">
                        <code>{typeof log.data === "string" ? log.data : JSON.stringify(log.data, null, 2)}</code>
                      </pre>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
