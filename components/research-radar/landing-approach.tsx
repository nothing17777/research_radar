"use client";

import { useState } from "react";
import { Radar, Gauge, GitCompare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Radar,
    title: "Every source is scanned",
    description:
      "Active sources — arXiv, technical blogs, and trending GitHub repos — are checked on a schedule. Only real paper and repo detail pages are kept; listing pages, ads, and nav are filtered out before anything is saved.",
  },
  {
    icon: Gauge,
    title: "Every paper is scored",
    description:
      "An AI pass produces a neutral summary, a 1-10 technical difficulty score, a beginner/intermediate/expert label, and three developer-focused takeaways — always labeled as an AI estimate, never presented as fact.",
  },
  {
    icon: GitCompare,
    title: "Related work surfaces itself",
    description:
      "Every analysis is embedded and indexed with pgvector, so opening one paper shows you the five closest related papers and repos by cosine similarity — no manual tagging required.",
  },
];

function StepPreview({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="flex h-full flex-col justify-center gap-3 p-8">
        {["arXiv cs.AI", "Google Research Blog", "GitHub Trending Rust"].map((source, i) => (
          <div
            key={source}
            className="flex items-center justify-between rounded-lg border border-sky-900/10 bg-white/70 px-4 py-3 text-sm"
            style={{ opacity: 1 - i * 0.12 }}
          >
            <span className="text-sky-950/80">{source}</span>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
              active
            </Badge>
          </div>
        ))}
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="flex h-full flex-col justify-center gap-4 p-8">
        <div className="flex overflow-hidden rounded-lg border border-sky-900/10 text-xs font-medium">
          <div className="flex-1 bg-emerald-500/15 px-3 py-2 text-center text-sky-900/50">Beginner</div>
          <div className="flex-1 bg-amber-500/15 px-3 py-2 text-center text-sky-900/50">Intermediate</div>
          <div className="flex-1 bg-rose-500/20 px-3 py-2 text-center text-sky-950">Expert</div>
        </div>
        <p className="text-xs text-sky-900/60">Score 8/10 · AI-estimated from methodology and prerequisites</p>
        <ul className="flex flex-col gap-2 text-xs text-sky-900/70">
          <li>• Splits reasoning into trials run in parallel</li>
          <li>• Cuts wall-clock latency ~2.3x on long chains</li>
          <li>• Needs a scheduler-aware inference stack</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="relative flex h-full items-center justify-center p-8">
      <div className="relative size-40">
        <div className="absolute inset-0 flex items-center justify-center rounded-full border border-sky-700/40 bg-sky-500/15 text-[11px] font-medium text-sky-950">
          this paper
        </div>
        {[0, 72, 144, 216, 288].map((angle) => (
          <div
            key={angle}
            className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-sky-900/10 bg-white/70 text-[10px] text-sky-900/70"
            style={{
              transform: `translate(-50%, -50%) rotate(${angle}deg) translate(90px) rotate(-${angle}deg)`,
            }}
          >
            {(0.94 - angle / 1000).toFixed(2)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingApproach() {
  const [active, setActive] = useState(0);

  return (
    <div className="grid grid-cols-1 gap-9 lg:grid-cols-[42fr_58fr]">
      <div className="flex flex-col">
        {STEPS.map((step, i) => (
          <button
            key={step.title}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "flex min-h-[35vh] cursor-pointer flex-col justify-center gap-3 py-11 text-left transition-opacity duration-500",
              active === i ? "opacity-100" : "opacity-40 hover:opacity-70",
            )}
          >
            <div className="flex items-center gap-2">
              <step.icon className="size-6 text-sky-950" />
              <h3 className="text-xl font-normal text-sky-950">{step.title}</h3>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-sky-900/70">{step.description}</p>
          </button>
        ))}
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-24">
          <Card className="aspect-8/5 overflow-hidden border-sky-900/10 bg-white/50 p-0 backdrop-blur-sm">
            <CardContent className="h-full p-0">
              <StepPreview index={active} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="lg:hidden">
        <Card className="aspect-8/5 overflow-hidden border-sky-900/10 bg-white/50 p-0 backdrop-blur-sm">
          <CardContent className="h-full p-0">
            <StepPreview index={active} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
