"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import {
  History,
  Search,
  MessageSquare,
  Clock,
  Radio,
} from "lucide-react";

export default function MessageHistoryPage() {
  const params = useParams();
  const appId = params.id as string;

  const [channel, setChannel] = useState("my-channel");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [appId]);

  const loadHistory = async () => {
    if (!channel.trim()) return;
    setLoading(true);

    try {
      const res = await fetchWithAuth(`/apps/${appId}/channels/${channel}/history?limit=50`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.messages) ? data.messages : (Array.isArray(data) ? data : []);
        setMessages(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadHistory();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-blue-400" />
            Message History & Replay
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Replay historical channel messages for late-joining clients via REST API or console.
          </p>
        </div>
      </div>

      {/* Channel Query Bar */}
      <div className="glass-panel p-4 rounded-xl shadow-lg">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Radio className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              required
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="Enter channel name..."
              className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{loading ? "Searching..." : "Fetch History"}</span>
          </button>
        </form>
      </div>

      {/* Messages Feed */}
      <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
        <h2 className="text-base font-semibold text-white">
          Events Log for <span className="font-mono text-blue-400">#{channel}</span> ({(messages || []).length})
        </h2>

        {(messages || []).length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No historical messages found for this channel. Events sent to this channel will be recorded and retrievable here.
          </div>
        ) : (
          <div className="space-y-3 font-mono text-xs">
            {(messages || []).map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">
                      {m.event_name}
                    </span>
                    {m.socket_id && (
                      <span className="text-slate-500">from socket {m.socket_id}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <pre className="text-[11px] text-slate-300 overflow-x-auto bg-slate-950/80 p-3 rounded-lg border border-slate-900">
                  <code>
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(m.payload), null, 2);
                      } catch {
                        return m.payload;
                      }
                    })()}
                  </code>
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
