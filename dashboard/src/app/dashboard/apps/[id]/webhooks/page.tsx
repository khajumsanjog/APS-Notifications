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
    "message_sent",
    "client_event",
    "channel_occupied",
    "channel_vacated",
    "member_added",
    "member_removed",
    "beams_push_delivered",
    "beams_device_registered",
    "beams_device_deleted",
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
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">Webhooks & Delivery Logs</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            HTTP POST callbacks dispatched with Pusher HMAC signatures when channel and push events occur.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="self-start sm:self-center py-2 px-3.5 rounded-lg bg-[#6941C6] hover:bg-[#592fa9] text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Webhook</span>
        </button>
      </div>

      {/* Webhook Endpoints List */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-5 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Configured Endpoints</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="py-1 px-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-[#6941C6] dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-xs font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <Plus className="w-3 h-3" />
            <span>Add Endpoint</span>
          </button>
        </div>

        {(webhooks || []).length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-zinc-500">
            No webhook endpoints configured. Add an endpoint to receive channel and push notifications.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
            {(webhooks || []).map((wh) => (
              <div key={wh.id} className="py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-slate-900 dark:text-zinc-200 flex items-center gap-2">
                    <span>{wh.url}</span>
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-[10px] font-sans font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {wh.events?.map((ev: string) => (
                      <span
                        key={ev}
                        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 text-[10px] font-mono text-slate-700 dark:text-zinc-400"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteWebhook(wh.id)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-zinc-900 transition cursor-pointer"
                  title="Delete Webhook"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delivery Log & Replay */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-5 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Delivery History ({(deliveries || []).length})</h2>
          <button
            onClick={loadData}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            title="Refresh logs"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {(deliveries || []).length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-zinc-500">
            No delivery records yet. Webhook attempts will be recorded here with HTTP response status codes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="pb-2.5 font-medium">Event</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium">HTTP Code</th>
                  <th className="pb-2.5 font-medium">Attempt</th>
                  <th className="pb-2.5 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
                {deliveries.map((del) => (
                  <tr key={del.id} className="text-slate-700 dark:text-zinc-300">
                    <td className="py-2.5 text-slate-900 dark:text-zinc-200 font-medium">{del.event}</td>
                    <td className="py-2.5">
                      {del.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-sans">
                          <CheckCircle2 className="w-3 h-3" /> 200 OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-[11px] font-sans">
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-slate-600 dark:text-zinc-400">{del.status_code || "—"}</td>
                    <td className="py-2.5 text-slate-600 dark:text-zinc-400">{del.attempt}</td>
                    <td className="py-2.5 text-slate-500 dark:text-zinc-500 text-[11px]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-md p-6 rounded-xl shadow-2xl space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Add Webhook Endpoint</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                APS will send HMAC-SHA256 signed POST requests to this URL.
              </p>
            </div>

            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Destination URL
                </label>
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://myserver.com/api/pusher/webhook"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 text-xs font-mono focus:outline-none focus:border-purple-600 dark:focus:border-zinc-500 transition shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Subscribed Events ({selectedEvents.length} selected)
                </label>
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1 border border-slate-200 dark:border-zinc-800 rounded-lg p-3 bg-slate-50/50 dark:bg-zinc-950/40">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Messages & Channel Activity
                    </div>
                    <div className="space-y-2 pl-0.5">
                      {[
                        { id: "message_sent", label: "message_sent — Channel message broadcast" },
                        { id: "client_event", label: "client_event — Client peer event" },
                        { id: "channel_occupied", label: "channel_occupied — First subscriber joined" },
                        { id: "channel_vacated", label: "channel_vacated — Last subscriber left" },
                      ].map((ev) => (
                        <label key={ev.id} className="flex items-center gap-2.5 text-xs text-slate-800 dark:text-zinc-200 cursor-pointer hover:text-slate-950 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes(ev.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedEvents([...selectedEvents, ev.id]);
                              else setSelectedEvents(selectedEvents.filter((item) => item !== ev.id));
                            }}
                            className="rounded border-slate-300 dark:border-zinc-700 accent-[#6941C6] text-white focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="font-mono text-[11px] text-slate-800 dark:text-zinc-200">{ev.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 pt-2 border-t border-slate-200 dark:border-zinc-800/80">
                      Presence Channels
                    </div>
                    <div className="space-y-2 pl-0.5">
                      {[
                        { id: "member_added", label: "member_added — User subscribed to presence" },
                        { id: "member_removed", label: "member_removed — User left presence channel" },
                      ].map((ev) => (
                        <label key={ev.id} className="flex items-center gap-2.5 text-xs text-slate-800 dark:text-zinc-200 cursor-pointer hover:text-slate-950 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes(ev.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedEvents([...selectedEvents, ev.id]);
                              else setSelectedEvents(selectedEvents.filter((item) => item !== ev.id));
                            }}
                            className="rounded border-slate-300 dark:border-zinc-700 accent-[#6941C6] text-white focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="font-mono text-[11px] text-slate-800 dark:text-zinc-200">{ev.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 pt-2 border-t border-slate-200 dark:border-zinc-800/80">
                      APS Beams (Push Notifications)
                    </div>
                    <div className="space-y-2 pl-0.5">
                      {[
                        { id: "beams_push_delivered", label: "beams_push_delivered — Push notification published" },
                        { id: "beams_device_registered", label: "beams_device_registered — New FCM/APNs device" },
                        { id: "beams_device_deleted", label: "beams_device_deleted — Device token unregistered" },
                      ].map((ev) => (
                        <label key={ev.id} className="flex items-center gap-2.5 text-xs text-slate-800 dark:text-zinc-200 cursor-pointer hover:text-slate-950 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes(ev.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedEvents([...selectedEvents, ev.id]);
                              else setSelectedEvents(selectedEvents.filter((item) => item !== ev.id));
                            }}
                            className="rounded border-slate-300 dark:border-zinc-700 accent-[#6941C6] text-white focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="font-mono text-[11px] text-slate-800 dark:text-zinc-200">{ev.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#6941C6] hover:bg-[#592fa9] text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 transition cursor-pointer shadow-xs"
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
