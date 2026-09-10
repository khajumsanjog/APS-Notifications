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
  Shield,
  Clock,
  ArrowRight,
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
          msg: `Notification published (ID: ${resData.publish_id}). Delivered to ${resData.sent_count} device targets.`,
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
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">APS Beams Push Notifications</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Deliver mobile push notifications via FCM (Android) and APNs (iOS) with interest topics or authenticated user IDs.
          </p>
        </div>

        <div className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400">
          Instance: <span className="text-slate-900 dark:text-zinc-200 font-semibold">{beamsInstance?.instance_id || "None"}</span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 text-xs border ${
            feedback.success
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300"
          }`}
        >
          {feedback.success ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Publish Notification */}
        <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-5 rounded-xl space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Publish Notification</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Send a test notification to subscribers or individual users.</p>
          </div>

          <form onSubmit={handleSendPush} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1.5">
                Targeting Type
              </label>
              <div className="grid grid-cols-2 gap-2 p-0.5 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setTargetType("interest")}
                  className={`py-1.5 rounded-md transition cursor-pointer ${
                    targetType === "interest"
                      ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  Interest (Topic)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType("user")}
                  className={`py-1.5 rounded-md transition cursor-pointer ${
                    targetType === "user"
                      ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  Authenticated User ID
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                {targetType === "interest" ? "Interest Name" : "User ID"}
              </label>
              <input
                type="text"
                required
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={targetType === "interest" ? "e.g. announcements" : "e.g. usr_1001"}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-purple-600 dark:focus:border-zinc-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                Notification Title
              </label>
              <input
                type="text"
                required
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-purple-600 dark:focus:border-zinc-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-zinc-400 mb-1">
                Message Body
              </label>
              <textarea
                rows={3}
                required
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-purple-600 dark:focus:border-zinc-500 transition leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2 px-3 rounded-lg bg-[#6941C6] hover:bg-[#592fa9] text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 text-xs font-medium transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Send className="w-3 h-3" />
              <span>{sending ? "Publishing..." : "Publish Notification"}</span>
            </button>
          </form>
        </div>

        {/* Credentials Manager */}
        <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-5 rounded-xl space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Push Gateway Credentials</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Encrypted AES-256-GCM storage. Simulation mode active for local development.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900 dark:text-zinc-200">Firebase Cloud Messaging (FCM)</span>
              <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-300 text-[10px] font-mono">
                {beamsInstance?.has_fcm || fcmStatus ? "Configured" : "Dev Simulation"}
              </span>
            </div>
            <form onSubmit={handleSaveFCM} className="space-y-2 pt-1">
              <textarea
                rows={3}
                value={fcmJSON}
                onChange={(e) => setFcmJSON(e.target.value)}
                placeholder='Paste Firebase service-account.json...'
                className="w-full p-2 text-[11px] font-mono rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-300 focus:outline-none focus:border-purple-600 dark:focus:border-zinc-500 transition"
              />
              <button
                type="submit"
                className="py-1.5 px-3 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs text-white dark:text-zinc-200 transition cursor-pointer font-medium shadow-xs"
              >
                Save FCM Service Account
              </button>
            </form>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900 dark:text-zinc-200">Apple Push Notifications (APNs)</span>
              <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-300 text-[10px] font-mono">
                {beamsInstance?.has_apns ? "Configured" : "Dev Simulation"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 leading-normal">
              Supports .p8 Auth Key with token-based HTTP/2 connection pooling.
            </p>
          </div>
        </div>
      </div>

      {/* Registered Devices Table */}
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-5 rounded-xl space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
          Registered Devices ({(devices || []).length})
        </h2>

        {(devices || []).length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-zinc-500">
            No devices registered yet. Devices register via <span className="font-mono text-slate-600 dark:text-zinc-400">POST /beams/{'{instance_id}'}/devices/*/register</span>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="pb-2.5 font-medium">Device ID</th>
                  <th className="pb-2.5 font-medium">Platform</th>
                  <th className="pb-2.5 font-medium">Token Preview</th>
                  <th className="pb-2.5 font-medium">User ID</th>
                  <th className="pb-2.5 font-medium">Interests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
                {(devices || []).map((d) => (
                  <tr key={d.device_id} className="text-slate-700 dark:text-zinc-300">
                    <td className="py-2.5 text-slate-900 dark:text-zinc-200 font-medium">{d.device_id}</td>
                    <td className="py-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-[10px] uppercase font-semibold">
                        {d.platform}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-500 dark:text-zinc-500 truncate max-w-xs">{d.token}</td>
                    <td className="py-2.5 text-slate-600 dark:text-zinc-400">{d.user_id || "—"}</td>
                    <td className="py-2.5">
                      {d.interests?.map((it: string) => (
                        <span key={it} className="mr-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[10px] text-slate-700 dark:text-zinc-300">
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
      <div className="bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-xs p-5 rounded-xl space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
          Push Publish History ({(deliveries || []).length})
        </h2>

        {(deliveries || []).length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-zinc-500">
            No push notifications published yet. Use the publisher above to send test pushes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="pb-2.5 font-medium">Publish ID</th>
                  <th className="pb-2.5 font-medium">Target Type</th>
                  <th className="pb-2.5 font-medium">Target</th>
                  <th className="pb-2.5 font-medium">Sent Count</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
                {(deliveries || []).map((pub) => (
                  <tr key={pub.id} className="text-slate-700 dark:text-zinc-300">
                    <td className="py-2.5 text-slate-900 dark:text-zinc-200">{pub.id}</td>
                    <td className="py-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-[10px] font-sans font-medium">
                        {pub.target_type}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-800 dark:text-zinc-300">{pub.target_value}</td>
                    <td className="py-2.5 text-slate-600 dark:text-zinc-400">{pub.sent_count} devices</td>
                    <td className="py-2.5">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-sans">
                        <CheckCircle className="w-3 h-3" /> Dispatched
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-500 dark:text-zinc-500 text-[11px]">
                      {new Date(pub.created_at).toLocaleTimeString()}
                    </td>
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
