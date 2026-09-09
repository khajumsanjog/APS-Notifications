"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { fetchWithAuth, clearAuthToken } from "@/lib/api";
import {
  Radio,
  Layers,
  Terminal,
  Bell,
  Webhook,
  History,
  Key,
  LogOut,
  Plus,
  ChevronDown,
  Activity,
} from "lucide-react";

interface AppItem {
  id: string;
  name: string;
  app_key: string;
  cluster: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppCluster, setNewAppCluster] = useState("mt1");

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      const res = await fetchWithAuth("/api/apps");
      if (res.ok) {
        const data = await res.json();
        setApps(data || []);
        if (data && data.length > 0) {
          // If URL already contains an app ID, pick it
          const parts = pathname.split("/");
          const appIndex = parts.indexOf("apps");
          if (appIndex !== -1 && parts[appIndex + 1]) {
            const currentAppId = parts[appIndex + 1];
            const found = data.find((a: AppItem) => a.id === currentAppId);
            if (found) setSelectedApp(found);
            else setSelectedApp(data[0]);
          } else {
            setSelectedApp(data[0]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load apps", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim()) return;

    try {
      const res = await fetchWithAuth("/api/apps", {
        method: "POST",
        body: JSON.stringify({ name: newAppName, cluster: newAppCluster }),
      });
      if (res.ok) {
        const created = await res.json();
        setApps([...apps, created]);
        setSelectedApp(created);
        setShowCreateModal(false);
        setNewAppName("");
        router.push(`/dashboard/apps/${created.id}`);
      }
    } catch (err) {
      console.error("Failed to create app", err);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    router.push("/login");
  };

  const currentAppId = selectedApp ? selectedApp.id : "";

  const navItems = [
    { name: "Overview & Keys", href: `/dashboard/apps/${currentAppId}`, icon: Key },
    { name: "Live Debug Console", href: `/dashboard/apps/${currentAppId}/debug`, icon: Terminal },
    { name: "APS Beams Push", href: `/dashboard/apps/${currentAppId}/beams`, icon: Bell },
    { name: "Webhooks & Replay", href: `/dashboard/apps/${currentAppId}/webhooks`, icon: Webhook },
    { name: "Message History", href: `/dashboard/apps/${currentAppId}/history`, icon: History },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#090d16]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800/80 bg-[#0d1322] flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800/80">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-white">APS Console</div>
            <div className="text-[10px] font-mono text-blue-400">aps.khajumsanjog.com</div>
          </div>
        </div>

        {/* App Switcher */}
        <div className="p-4 border-b border-slate-800/80">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Application
          </label>
          {apps.length > 0 ? (
            <div className="relative">
              <select
                value={selectedApp?.id || ""}
                onChange={(e) => {
                  const a = apps.find((item) => item.id === e.target.value);
                  if (a) {
                    setSelectedApp(a);
                    router.push(`/dashboard/apps/${a.id}`);
                  }
                }}
                className="w-full appearance-none px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.cluster})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          ) : (
            <div className="text-xs text-slate-500">No applications found</div>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full mt-2 py-1.5 px-3 rounded-lg border border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5 text-xs text-slate-400 hover:text-blue-300 flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New App</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {selectedApp ? (
            navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? "bg-blue-600/15 text-blue-400 border border-blue-500/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })
          ) : (
            <div className="p-4 text-center text-xs text-slate-500">
              Create or select an app to view developer tools.
            </div>
          )}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-[11px] text-slate-400 font-mono">Cluster: mt1 (Online)</span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="text-slate-400 hover:text-red-400 p-1.5 rounded-md hover:bg-slate-800/60 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </main>

      {/* Create App Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Create Application</h3>
            <p className="text-xs text-slate-400 mb-6">
              Create a new Pusher Channels & Beams tenant app with isolated credentials.
            </p>

            <form onSubmit={handleCreateApp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  App Name
                </label>
                <input
                  type="text"
                  required
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  placeholder="e.g. Khajum Sanjog Mobile"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Cluster
                </label>
                <select
                  value={newAppCluster}
                  onChange={(e) => setNewAppCluster(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="mt1">mt1 (US East / Primary)</option>
                  <option value="eu">eu (Europe)</option>
                  <option value="ap1">ap1 (Asia Pacific)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition"
                >
                  Create Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
