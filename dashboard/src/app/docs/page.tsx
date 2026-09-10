"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Radio,
  ExternalLink,
  ChevronRight,
  Menu,
  X,
  Layers,
  Sparkles,
  Github,
  Zap,
} from "lucide-react";
import { DOCS_SECTIONS } from "./docs-data";
import { ARTICLES_MAP } from "./articles";
import { ThemeToggle } from "@/components/ThemeToggle";

function DocsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const docParam = searchParams.get("doc") || "javascript-quickstart";
  const [activeDocId, setActiveDocId] = useState<string>(docParam);
  const [activeCategory, setActiveCategory] = useState<"CHANNELS" | "BEAMS" | "SERVER" | "DEPLOYMENT">("CHANNELS");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (docParam && ARTICLES_MAP[docParam]) {
      setActiveDocId(docParam);
      setActiveCategory(ARTICLES_MAP[docParam].category);
    }
  }, [docParam]);

  const activeArticle = useMemo(() => {
    return ARTICLES_MAP[activeDocId] || ARTICLES_MAP["javascript-quickstart"];
  }, [activeDocId]);

  const selectDoc = (id: string) => {
    setActiveDocId(id);
    setMobileMenuOpen(false);
    setIsSearchOpen(false);
    setSearchQuery("");
    router.push(`/docs?doc=${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: { id: string; title: string; category: string; snippet: string }[] = [];

    Object.entries(ARTICLES_MAP).forEach(([id, article]) => {
      if (article.title.toLowerCase().includes(q) || article.description.toLowerCase().includes(q)) {
        results.push({
          id,
          title: article.title,
          category: article.category,
          snippet: article.description,
        });
      }
    });

    return results;
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 font-sans flex flex-col selection:bg-purple-100 dark:selection:bg-purple-900/40 selection:text-purple-900 dark:selection:text-purple-200 transition-colors">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 h-16 flex items-center justify-between px-4 sm:px-8">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/docs" className="flex items-center gap-2.5 no-underline group">
            <div className="w-8 h-8 rounded-lg bg-[#381254] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition">
              <Radio className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-gray-950 dark:text-white font-mono">APS</span>
              <span className="text-xl font-normal text-gray-600 dark:text-zinc-400">Docs</span>
            </div>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-[#6941C6] dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              v1.0 (Pusher Compatible)
            </span>
          </Link>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-lg mx-4 hidden md:block relative">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 dark:bg-zinc-900 hover:bg-gray-100/80 dark:hover:bg-zinc-800/80 focus:bg-white dark:focus:bg-zinc-950 border border-gray-300 dark:border-zinc-800 focus:border-[#6941C6] dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-950 rounded-lg text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute top-12 left-0 right-0 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50 divide-y divide-gray-100 dark:divide-zinc-800 max-h-96 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => selectDoc(result.id)}
                  className="w-full text-left p-3 hover:bg-purple-50/60 dark:hover:bg-purple-950/40 transition cursor-pointer flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{result.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
                      {result.category}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-1">{result.snippet}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm font-medium text-gray-700 dark:text-zinc-300 hover:text-gray-950 dark:hover:text-white px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition no-underline"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium text-white bg-[#6941C6] hover:bg-[#592fa9] px-4 py-1.5 rounded-lg shadow-xs transition no-underline flex items-center gap-1.5"
          >
            <span>Sign up</span>
          </Link>
          <Link
            href="/dashboard"
            className="hidden sm:flex text-xs font-mono text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 items-center gap-1 transition no-underline"
          >
            <span>Console</span>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </Link>
        </div>
      </header>

      {/* 2. Main Body Container (3-Column Layout) */}
      <div className="flex-1 flex max-w-[1540px] w-full mx-auto">
        {/* Left Column: Navigation Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-72 bg-white dark:bg-[#09090b] border-r border-gray-200 dark:border-zinc-800 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 overflow-y-auto ${
            mobileMenuOpen ? "translate-x-0 top-16" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="p-4 space-y-6">
            {/* Category Selector Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 dark:bg-zinc-900 rounded-lg text-xs font-semibold">
              {(["CHANNELS", "SERVER", "BEAMS", "DEPLOYMENT"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`py-1.5 px-2 rounded-md transition cursor-pointer text-center ${
                    activeCategory === cat
                      ? "bg-white dark:bg-zinc-800 text-gray-950 dark:text-white shadow-xs font-bold"
                      : "text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {cat === "CHANNELS" ? "Channels" : cat === "SERVER" ? "Server SDK" : cat === "BEAMS" ? "Beams Push" : "Deployment"}
                </button>
              ))}
            </div>

            {/* Render Groups for the selected category */}
            {DOCS_SECTIONS.filter((sec) => sec.category === activeCategory).map((sec) => (
              <div key={sec.category} className="space-y-6">
                {sec.groups.map((group) => (
                  <div key={group.name} className="space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 px-2 font-mono">
                      {group.name}
                    </div>

                    {group.subsections.map((sub) => (
                      <div key={sub.title} className="space-y-1">
                        <div className="text-xs font-semibold text-gray-600 dark:text-zinc-400 px-2 py-1">
                          {sub.title}
                        </div>
                        <div className="space-y-0.5">
                          {sub.items.map((item) => {
                            const isActive = activeDocId === item.id;
                            return (
                              <button
                                key={item.id}
                                onClick={() => selectDoc(item.id)}
                                className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition cursor-pointer block ${
                                  isActive
                                    ? "bg-[#381254] text-white font-medium shadow-xs"
                                    : "text-gray-700 dark:text-zinc-300 hover:text-[#6941C6] dark:hover:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/30"
                                }`}
                              >
                                {item.title}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}

            {/* Quick Links Box */}
            <div className="pt-4 border-t border-gray-200 dark:border-zinc-800 text-xs space-y-2 text-gray-500 dark:text-zinc-400">
              <div className="font-semibold text-gray-700 dark:text-zinc-300">Explore APS Resources</div>
              <Link href="/dashboard" className="block text-[#6941C6] dark:text-purple-400 hover:underline">
                → Open Developer Console
              </Link>
              <Link href="/login" className="block text-[#6941C6] dark:text-purple-400 hover:underline">
                → Live Debug Console
              </Link>
              <a
                href="https://pusher.com/docs/channels/getting_started/android/"
                target="_blank"
                rel="noreferrer"
                className="block text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300"
              >
                → Official Pusher Reference ↗
              </a>
            </div>
          </div>
        </aside>

        {/* Center Column: Documentation Article */}
        <main className="flex-1 min-w-0 px-6 sm:px-12 py-10 max-w-4xl">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 mb-6 font-medium">
            <span>Docs</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="capitalize">{activeArticle.category.toLowerCase()}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-900 dark:text-white font-semibold">{activeArticle.title}</span>
          </div>

          {/* Article Title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-950 dark:text-white tracking-tight mb-4">
            {activeArticle.title}
          </h1>

          {/* Render Active Article Content */}
          <div className="article-body dark:text-zinc-200">
            {activeArticle.content}
          </div>

          {/* Bottom Feedback Bar */}
          <div className="mt-16 pt-8 border-t border-gray-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500 dark:text-zinc-400">
            <div>
              <span>Documentation version: </span>
              <strong className="font-mono text-gray-700 dark:text-zinc-300">APS v1.0.0 (Go 1.26.4+)</strong>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/khajumsanjog/AdhanPradhanServices"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white no-underline"
              >
                <Github className="w-3.5 h-3.5" />
                <span>GitHub Repository</span>
              </a>
            </div>
          </div>
        </main>

        {/* Right Column: Table of Contents */}
        <aside className="hidden xl:block w-72 p-8 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div className="p-5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs">
              <h3 className="text-sm font-bold text-gray-950 dark:text-white uppercase tracking-wider font-mono mb-3.5 border-b border-gray-100 dark:border-zinc-800 pb-2">
                Contents
              </h3>
              <nav className="space-y-1.5">
                {activeArticle.tableOfContents.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block text-xs text-gray-600 dark:text-zinc-400 hover:text-[#6941C6] dark:hover:text-purple-400 hover:font-medium leading-relaxed transition py-0.5 no-underline"
                  >
                    {item.title}
                  </a>
                ))}
              </nav>
            </div>

            <div className="px-2 text-xs text-gray-500 dark:text-zinc-400 leading-relaxed space-y-1">
              <p>Spotted something that isn't quite right?</p>
              <a
                href="https://github.com/khajumsanjog/AdhanPradhanServices/issues"
                target="_blank"
                rel="noreferrer"
                className="text-[#6941C6] dark:text-purple-400 font-medium hover:underline block"
              >
                Create an issue on GitHub ↗
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-gray-500">Loading APS Documentation...</div>}>
      <DocsContent />
    </Suspense>
  );
}
