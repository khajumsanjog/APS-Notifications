"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import {
  History,
  Search,
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
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Message History & Replay</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Retrieve past channel events for late-joining clients via REST API or replay on demand.
          </p>
        </div>
      </div>

      {/* Channel Query Bar */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-3.5 rounded-xl">
        <form onSubmit={handleSearch} className="flex gap-2.5">
          <div className="relative flex-1">
            <Radio className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              required
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="Enter channel name..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 text-xs font-mono placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-400 dark:focus:border-zinc-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Search className="w-3 h-3" />
            <span>{loading ? "Searching..." : "Fetch History"}</span>
          </button>
        </form>
      </div>

      {/* Messages Feed */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-5 rounded-xl space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
          Events for <span className="font-mono text-slate-700 dark:text-zinc-300">#{channel}</span> ({(messages || []).length})
        </h2>

        {(messages || []).length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-zinc-500">
            No historical messages found for this channel. Messages published to <span className="font-mono text-slate-600 dark:text-zinc-400">#{channel}</span> will appear here.
          </div>
        ) : (
          <div className="space-y-2.5 font-mono text-xs">
            {(messages || []).map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 space-y-2 hover:border-slate-300 dark:hover:border-zinc-700/80 transition"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 font-mono text-xs font-semibold shadow-2xs">
                      {m.event_name}
                    </span>
                    {m.socket_id && (
                      <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px]">socket: {m.socket_id}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-400 text-[10px]">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <pre className="text-[11px] text-slate-800 dark:text-zinc-300 overflow-x-auto bg-slate-100 dark:bg-zinc-900/80 p-2.5 rounded border border-slate-200 dark:border-zinc-800 leading-relaxed">
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
