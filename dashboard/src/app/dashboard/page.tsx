"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import { Radio } from "lucide-react";

export default function DashboardIndex() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth("/api/apps")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.length > 0) {
          router.push(`/dashboard/apps/${data[0].id}`);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-200 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 flex flex-col items-center justify-center text-center bg-zinc-950">
      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center mb-3">
        <Radio className="w-5 h-5" />
      </div>
      <h2 className="text-base font-semibold text-zinc-100 mb-1">Welcome to APS Infrastructure</h2>
      <p className="text-xs text-zinc-400 max-w-sm">
        Create an application in the sidebar to get started with Pusher Channels and APS Beams.
      </p>
    </div>
  );
}
