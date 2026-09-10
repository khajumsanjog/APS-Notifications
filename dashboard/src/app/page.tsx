"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-200 rounded-full animate-spin"></div>
        <p className="text-xs text-zinc-400 font-medium">Loading APS Console...</p>
      </div>
    </div>
  );
}
