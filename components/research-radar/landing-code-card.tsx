"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SAMPLE_JSON = `{
  "title": "Parason: Subtask Parallelism in LLM Reasoning",
  "difficulty_label": "expert",
  "technical_difficulty_score": 8,
  "key_takeaways": [
    "Splits reasoning into trials run in parallel",
    "Cuts wall-clock latency ~2.3x on long chains",
    "Needs a scheduler-aware inference stack"
  ]
}`;

export function LandingCodeCard() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(SAMPLE_JSON);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl shadow-sky-900/20">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-auto gap-1.5 px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check data-icon="inline-start" className="size-3" /> : <Copy data-icon="inline-start" className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre
        className={cn(
          "overflow-x-auto p-5 font-mono text-[13px] leading-relaxed whitespace-pre text-white/90",
        )}
      >
        {SAMPLE_JSON}
      </pre>
    </div>
  );
}
