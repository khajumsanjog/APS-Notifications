"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import {
  Webhook,
  Plus,
  Trash2,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
} from "lucide-react";

export default function WebhooksPage() {
  const params = useParams();
  const appId = params.id as string;

  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "channel_occupied",
    "channel_vacated",
    "member_added",
    "member_removed",
    "client_event",
  ]);

  useEffect(() => {
    loadData();
  }, [appId]);

  const loadData = async () => {
    try {
      const [whRes, delivRes] = await Promise.all([
        fetchWithAuth(`/api/apps/${appId}/webhooks`),
        fetchWithAuth(`/api/apps/${appId}/webhooks/deliveries`),
      ]);

      if (whRes.ok) {
        const whData = await whRes.json();
        setWebhooks(Array.isArray(whData) ? whData : []);
      }
      if (delivRes.ok) {
        const delivData = await delivRes.json();
        setDeliveries(Array.isArray(delivData) ? delivData : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    try {
      const res = await fetchWithAuth(`/api/apps/${appId}/webhooks`, {
        method: "POST",
        body: JSON.stringify({
          url: newUrl,
          events: selectedEvents,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewUrl("");
        loadData();
      }
    } catch (err) {
      console.error("Failed to create webhook", err);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await fetchWithAuth(`/api/apps/${appId}/webhooks/${id}`, { method: "DELETE" });
      setWebhooks(webhooks.filter((w) => w.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Webhook className="w-6 h-6 text-blue-400" />
            Webhooks & Dead-Letter Replay
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            HTTP POST callbacks dispatched with Pusher HMAC signatures when channel events occur.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="py-2 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add Webhook Endpoint</span>
        </button>
      </div>

      {/* Webhook Endpoints List */}
      <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
        <h2 className="text-base font-semibold text-white">Configured Endpoints</h2>

        {(webhooks || []).length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No webhook endpoints configured. Add a URL to receive presence and client event callbacks.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {(webhooks || []).map((wh) => (
              <div key={wh.id} className="py-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-mono text-white flex items-center gap-2">
                    <span>{wh.url}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-sans">
                      Active
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {wh.events?.map((ev: string) => (
                      <span
                        key={ev}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteWebhook(wh.id)}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                  title="Delete Webhook"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery Log & Replay */}
      <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Delivery History ({(deliveries || []).length})</h2>
          </div>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {(deliveries || []).length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No delivery records yet. Webhook attempts will be logged here with HTTP response codes and replay options.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="pb-3 font-semibold">Event</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">HTTP Code</th>
                  <th className="pb-3 font-semibold">Attempt</th>
                  <th className="pb-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {deliveries.map((del) => (
                  <tr key={del.id} className="text-slate-300">
                    <td className="py-3 font-semibold text-white">{del.event}</td>
                    <td className="py-3">
                      {del.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 200 OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400 text-[11px]">
                          <XCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3">{del.status_code || "—"}</td>
                    <td className="py-3">{del.attempt}</td>
                    <td className="py-3 text-slate-500">
                      {new Date(del.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Webhook Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Add Webhook Destination</h3>
            <p className="text-xs text-slate-400 mb-6">
              APS will send HMAC-SHA256 signed POST requests to this URL.
            </p>

            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/api/pusher/webhook"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Subscribed Events
                </label>
                <div className="space-y-2">
                  {[
                    "channel_occupied",
                    "channel_vacated",
                    "member_added",
                    "member_removed",
                    "client_event",
                  ].map((ev) => (
                    <label key={ev} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(ev)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedEvents([...selectedEvents, ev]);
                          else setSelectedEvents(selectedEvents.filter((item) => item !== ev));
                        }}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0"
                      />
                      <span className="font-mono">{ev}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition"
                >
                  Save Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
