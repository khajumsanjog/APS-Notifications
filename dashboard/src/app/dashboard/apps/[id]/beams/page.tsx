"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import {
  Bell,
  Send,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Upload,
  Shield,
  Clock,
  Sparkles,
} from "lucide-react";

export default function BeamsPushPage() {
  const params = useParams();
  const appId = params.id as string;

  const [beamsInstance, setBeamsInstance] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Push form state
  const [targetType, setTargetType] = useState<"interest" | "user">("interest");
  const [targetValue, setTargetValue] = useState("announcements");
  const [pushTitle, setPushTitle] = useState("New Update Available");
  const [pushBody, setPushBody] = useState("Welcome to APS Beams push notification engine!");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  // FCM upload state
  const [fcmJSON, setFcmJSON] = useState("");
  const [fcmStatus, setFcmStatus] = useState(false);

  useEffect(() => {
    loadBeamsData();
  }, [appId]);

  const loadBeamsData = async () => {
    try {
      const appRes = await fetchWithAuth(`/api/apps/${appId}`);
      if (appRes.ok) {
        const data = await appRes.json();
        const inst = data.beams_instance;
        setBeamsInstance(inst);

        if (inst?.instance_id) {
          // Load devices & deliveries
          const devRes = await fetchWithAuth(`/beams/${inst.instance_id}/devices`);
          if (devRes.ok) {
            const devData = await devRes.json();
            setDevices(Array.isArray(devData) ? devData : []);
          }

          const delivRes = await fetchWithAuth(`/beams/${inst.instance_id}/publishes`);
          if (delivRes.ok) {
            const delivData = await delivRes.json();
            setDeliveries(Array.isArray(delivData) ? delivData : []);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beamsInstance?.instance_id) return;

    setSending(true);
    setFeedback(null);

    try {
      const endpoint =
        targetType === "interest"
          ? `/beams/${beamsInstance.instance_id}/publishes/interests`
          : `/beams/${beamsInstance.instance_id}/publishes/users`;

      const payload =
        targetType === "interest"
          ? {
              interests: [targetValue],
              fcm: { notification: { title: pushTitle, body: pushBody } },
              apns: { aps: { alert: { title: pushTitle, body: pushBody } } },
            }
          : {
              users: [targetValue],
              fcm: { notification: { title: pushTitle, body: pushBody } },
              apns: { aps: { alert: { title: pushTitle, body: pushBody } } },
            };

      const res = await fetchWithAuth(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (res.ok) {
        setFeedback({
          success: true,
          msg: `Push published! Publish ID: ${resData.publish_id} (Delivered to ${resData.sent_count} device targets)`,
        });
        loadBeamsData();
      } else {
        throw new Error(resData.error || "Failed to publish push");
      }
    } catch (err: any) {
      setFeedback({ success: false, msg: err.message || "Failed to send push notification" });
    } finally {
      setSending(false);
    }
  };

  const handleSaveFCM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beamsInstance?.instance_id || !fcmJSON.trim()) return;

    try {
      const res = await fetchWithAuth(`/beams/${beamsInstance.instance_id}/credentials/fcm`, {
        method: "PUT",
        body: JSON.stringify({ service_account_json: fcmJSON }),
      });
      if (res.ok) {
        setFcmStatus(true);
        setFcmJSON("");
        loadBeamsData();
      }
    } catch (err) {
      console.error("Failed to save FCM JSON", err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-400" />
            APS Beams Push Notifications
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Topic-based interests, authenticated users, FCM and APNs multi-platform delivery.
          </p>
        </div>

        <div className="text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
          Instance ID: <span className="text-white">{beamsInstance?.instance_id || "None"}</span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-2 text-xs font-medium border ${
            feedback.success
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-red-500/10 border-red-500/20 text-red-300"
          }`}
        >
          {feedback.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Push Notification Console */}
        <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-semibold text-white">Publish Notification</h2>
          </div>

          <form onSubmit={handleSendPush} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Targeting Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType("interest")}
                  className={`py-2 text-xs font-medium rounded-lg border transition ${
                    targetType === "interest"
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  Interest (Topic)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType("user")}
                  className={`py-2 text-xs font-medium rounded-lg border transition ${
                    targetType === "user"
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  Authenticated User ID
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                {targetType === "interest" ? "Interest Name" : "User ID"}
              </label>
              <input
                type="text"
                required
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={targetType === "interest" ? "e.g. donations" : "e.g. usr_1001"}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Notification Title
              </label>
              <input
                type="text"
                required
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Message Body
              </label>
              <textarea
                rows={3}
                required
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{sending ? "Sending..." : "Publish Notification"}</span>
            </button>
          </form>
        </div>

        {/* Credentials Manager */}
        <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Push Credentials</h2>
          </div>
          <p className="text-xs text-slate-400">
            Stored encrypted with AES-256-GCM. APS automatically uses mock/simulation delivery in local dev mode.
          </p>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Firebase Cloud Messaging (FCM)</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px]">
                {beamsInstance?.has_fcm || fcmStatus ? "Configured" : "Dev Mock Active"}
              </span>
            </div>
            <form onSubmit={handleSaveFCM} className="space-y-2 pt-2">
              <textarea
                rows={3}
                value={fcmJSON}
                onChange={(e) => setFcmJSON(e.target.value)}
                placeholder='Paste Firebase service-account.json...'
                className="w-full p-2 text-[11px] font-mono rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition"
              >
                Save FCM Service Account
              </button>
            </form>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Apple Push Notifications (APNs)</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px]">
                {beamsInstance?.has_apns ? "Configured" : "Dev Mock Active"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Supports .p8 Auth Key with token-based HTTP/2 connection pooling.
            </p>
          </div>
        </div>
      </div>

      {/* Registered Devices Table */}
      {/* Registered Devices Table */}
      <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Registered Devices ({(devices || []).length})</h2>
          </div>
        </div>

        {(devices || []).length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No devices registered yet. Devices register via <span className="font-mono text-slate-400">POST /beams/{'{instance_id}'}/devices/*/register</span>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="pb-3 font-semibold">Device ID</th>
                  <th className="pb-3 font-semibold">Platform</th>
                  <th className="pb-3 font-semibold">Token Preview</th>
                  <th className="pb-3 font-semibold">User ID</th>
                  <th className="pb-3 font-semibold">Interests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {(devices || []).map((d) => (
                  <tr key={d.device_id} className="text-slate-300">
                    <td className="py-3 text-white">{d.device_id}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[11px] uppercase font-bold">
                        {d.platform}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500 truncate max-w-xs">{d.token}</td>
                    <td className="py-3 text-slate-400">{d.user_id || "—"}</td>
                    <td className="py-3">
                      {d.interests?.map((it: string) => (
                        <span key={it} className="mr-1 px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">
                          {it}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Push Deliveries History */}
      <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Push Publish History ({(deliveries || []).length})</h2>
          </div>
        </div>

        {(deliveries || []).length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No push notifications published yet. Use the publisher above to send test pushes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="pb-3 font-semibold">Publish ID</th>
                  <th className="pb-3 font-semibold">Target Type</th>
                  <th className="pb-3 font-semibold">Target</th>
                  <th className="pb-3 font-semibold">Sent Count</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {(deliveries || []).map((del) => (
                  <tr key={del.id} className="text-slate-300">
                    <td className="py-3 font-semibold text-white">{del.publish_id}</td>
                    <td className="py-3 uppercase text-[10px] text-slate-400">{del.target_type}</td>
                    <td className="py-3 text-blue-400">{del.target}</td>
                    <td className="py-3">{del.sent_count}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-sans font-medium">
                        {del.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">{new Date(del.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
