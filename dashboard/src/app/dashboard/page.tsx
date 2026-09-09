"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import { Layers, Plus, Radio, ArrowRight } from "lucide-react";

export default function DashboardIndex() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<any[]>([]);

  useEffect(() => {
    fetchWithAuth("/api/apps")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.length > 0) {
          router.push(`/dashboard/apps/${data[0].id}`);
        } else {
          setApps([]);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
        <Radio className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Welcome to APS Infrastructure</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        You haven't created any applications yet. Create your first app to get API keys for Pusher Channels and APS Beams.
      </p>
    </div>
  );
}
