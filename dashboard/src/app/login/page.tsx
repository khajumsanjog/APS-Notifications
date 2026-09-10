"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthToken, API_BASE } from "@/lib/api";
import { Radio, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("developer@khajumsanjog.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (tab === "login" ? "Invalid email or password" : "Registration failed"));
      }

      setAuthToken(data.token);
      setSuccessMsg(tab === "login" ? "Signed in successfully. Redirecting..." : "Account created. Redirecting...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 400);
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setTab("login");
    setEmail("developer@khajumsanjog.com");
    setPassword("password123");
    setError("");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 mb-4 shadow-sm">
            <Radio className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            APS Developer Console
          </h1>
          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
            Real-time WebSocket and push notification infrastructure
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 shadow-sm">
          {/* Segmented Tab Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-lg bg-zinc-950 border border-zinc-800/60 mb-5 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setError("");
              }}
              className={`py-1.5 rounded-md transition-colors ${
                tab === "login"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("register");
                setError("");
              }}
              className={`py-1.5 rounded-md transition-colors ${
                tab === "register"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/30 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1 leading-normal">{error}</div>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-950/30 border border-emerald-900/50 flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Work Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Password
                </label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm active:scale-[0.99]"
            >
              <span>{loading ? "Processing..." : tab === "login" ? "Sign In" : "Create Account"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Demo Helper Button */}
          <div className="mt-5 pt-4 border-t border-zinc-800/60 text-center">
            <button
              type="button"
              onClick={fillDemo}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 transition"
            >
              Use demo account: <span className="font-mono text-zinc-300">developer@khajumsanjog.com</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-zinc-500">
          APS v1.0.0 · Self-hosted cluster
        </div>
      </div>
    </div>
  );
}
