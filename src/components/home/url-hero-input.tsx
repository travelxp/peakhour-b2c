"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Sparkles } from "lucide-react";

export function UrlHeroInput() {
  const [url, setUrl] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    router.push(`/onboarding/add-business?url=${encodeURIComponent(url.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="group relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Link2 className="h-5 w-5 text-primary/60 transition-colors group-focus-within:text-primary" />
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste Website, Instagram, or LinkedIn URL"
          className="w-full rounded-lg border border-border/30 bg-[--ph-surface-100] py-6 pl-12 pr-4 text-foreground outline-none transition-all placeholder:text-foreground/30 focus:border-transparent focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <button
          type="submit"
          className="flex items-center gap-2 rounded bg-linear-to-br from-primary to-[--ph-amber-600] px-8 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all duration-200 hover:brightness-110"
        >
          Start with URL
          <Sparkles className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
