"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { fetchWithAuth, clearAuthToken } from "@/lib/api";
import {
  Radio,
  Terminal,
  Bell,
  Webhook,
  History,
  Key,
  LogOut,
  Plus,
  ChevronDown,
  BookOpen,
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
    { name: "API Docs & Quickstart", href: `/dashboard/apps/${currentAppId}/docs`, icon: BookOpen },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="w-60 border-r border-zinc-800/80 bg-zinc-950 flex flex-col shrink-0 select-none">
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-zinc-100 tracking-tight">APS</span>
              <span className="text-[10px] text-zinc-500 font-mono">Console</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
            v1.0
          </span>
        </div>

        {/* App Switcher */}
        <div className="p-3 border-b border-zinc-800/80">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 px-1">
            Application
          </div>
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
                className="w-full appearance-none px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-900/90 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-zinc-500 cursor-pointer pr-8 transition"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.cluster})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 top-2 pointer-events-none" />
            </div>
          ) : (
            <div className="text-xs text-zinc-500 px-1">No applications</div>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full mt-2 py-1.5 px-2.5 rounded-lg border border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Create Application</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {selectedApp ? (
            navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition ${
                    isActive
                      ? "bg-zinc-900 text-zinc-100 font-medium border border-zinc-800/90 shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-zinc-100" : "text-zinc-500"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })
          ) : (
            <div className="p-3 text-center text-xs text-zinc-500">
              Select an application
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-[11px] text-zinc-500 font-mono">mt1 · online</span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md hover:bg-zinc-900 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-zinc-950">
        {children}
      </main>

      {/* Create App Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm p-5 rounded-xl shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">Create Application</h3>
            <p className="text-xs text-zinc-400 mb-5">
              Set up a new isolated real-time tenant with unique API keys.
            </p>

            <form onSubmit={handleCreateApp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Application Name
                </label>
                <input
                  type="text"
                  required
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  placeholder="e.g. Mobile App Production"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Cluster Region
                </label>
                <select
                  value={newAppCluster}
                  onChange={(e) => setNewAppCluster(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 cursor-pointer transition"
                >
                  <option value="mt1">mt1 (Primary)</option>
                  <option value="eu">eu (Europe)</option>
                  <option value="ap1">ap1 (Asia Pacific)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
