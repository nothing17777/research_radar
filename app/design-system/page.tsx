import { Button } from "@/components/ui/button";
import { DifficultyBadge, type Difficulty } from "@/components/research-radar/difficulty-badge";
import { DifficultyMeter } from "@/components/research-radar/difficulty-meter";
import { CategoryPill } from "@/components/research-radar/category-pill";
import { PaperCard, type PaperCardData } from "@/components/research-radar/paper-card";

const CATEGORIES = ["LLMs", "NLP", "Computer Vision", "Systems", "Robotics"];

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "expert"];

const COLOR_SWATCHES = [
  { name: "Background", className: "bg-background" },
  { name: "Card", className: "bg-card" },
  { name: "Primary", className: "bg-primary" },
  { name: "Accent Indigo", className: "bg-accent-indigo" },
  { name: "Muted", className: "bg-muted" },
  { name: "Border", className: "bg-border" },
  { name: "Beginner", className: "bg-difficulty-beginner-bg" },
  { name: "Intermediate", className: "bg-difficulty-intermediate-bg" },
  { name: "Expert", className: "bg-difficulty-expert-bg" },
];

const SPACING_SCALE = [
  { name: "rr-1", value: "4px" },
  { name: "rr-2", value: "8px" },
  { name: "rr-3", value: "16px" },
  { name: "rr-4", value: "24px" },
  { name: "rr-5", value: "32px" },
  { name: "rr-6", value: "40px" },
  { name: "rr-7", value: "64px" },
];

const SHADOW_SCALE = [
  { name: "Small", style: { boxShadow: "var(--shadow-sm-token)" } },
  { name: "Medium", style: { boxShadow: "var(--shadow-md-token)" } },
  { name: "Large", style: { boxShadow: "var(--shadow-lg-token)" } },
];

const RADIUS_SCALE = [
  { name: "sm", className: "rounded-sm" },
  { name: "md", className: "rounded-md" },
  { name: "lg", className: "rounded-lg" },
  { name: "xl", className: "rounded-xl" },
  { name: "full", className: "rounded-full" },
];

const EXAMPLE_PAPER: PaperCardData = {
  id: "scaling-laws-rat",
  title: "Scaling Laws for Retrieval-Augmented Transformers",
  excerpt:
    "A study of how retrieval context length interacts with model size to affect downstream accuracy.",
  imageUrl: "/paper-placeholder.svg",
  categories: ["LLMs", "NLP"],
  difficulty: "expert",
  publishedLabel: "2h ago",
  readTimeLabel: "12 min read",
  kind: "paper",
};

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        <header className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-accent-indigo uppercase">
            Design System v1.0
          </span>
          <h1 className="text-3xl font-bold">Research Radar</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered academic paper and technical blog analysis, translated into a dark,
            premium UI kit.
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Colors</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {COLOR_SWATCHES.map((swatch) => (
              <div key={swatch.name} className="flex flex-col gap-2">
                <div className={`h-16 rounded-lg border border-border ${swatch.className}`} />
                <span className="text-xs text-muted-foreground">{swatch.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Typography</h2>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
            <h1 className="text-3xl font-bold">H1 — Page / Screen Title</h1>
            <h2 className="text-2xl font-semibold">H2 — Section Title</h2>
            <h3 className="text-xl font-semibold">H3 — Card / Module Title</h3>
            <h4 className="text-base font-medium">H4 — Subheading</h4>
            <p className="text-base">Body Large — Important content</p>
            <p className="text-sm">Body Medium — Body text</p>
            <p className="text-[13px]">Body Small — Supporting text</p>
            <p className="text-[11px] text-muted-foreground">Caption — Labels, meta text</p>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Buttons</h2>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-6">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Category Chips</h2>
          <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-6">
            {CATEGORIES.map((category) => (
              <CategoryPill key={category} label={category} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Technical Difficulty</h2>
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
            <DifficultyMeter active="intermediate" />
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((difficulty) => (
                <DifficultyBadge key={difficulty} difficulty={difficulty} />
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Spacing Scale</h2>
          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-6">
            {SPACING_SCALE.map((step) => (
              <div key={step.name} className="flex flex-col items-center gap-2">
                <div
                  className="bg-accent-indigo/40 rounded-sm"
                  style={{ width: step.value, height: step.value }}
                />
                <span className="text-xs text-muted-foreground">{step.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Shadows</h2>
          <div className="flex flex-wrap gap-6 rounded-xl border border-border bg-card p-6">
            {SHADOW_SCALE.map((shadow) => (
              <div key={shadow.name} className="flex flex-col items-center gap-2">
                <div className="size-16 rounded-lg bg-background" style={shadow.style} />
                <span className="text-xs text-muted-foreground">{shadow.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Border Radius</h2>
          <div className="flex flex-wrap gap-6 rounded-xl border border-border bg-card p-6">
            {RADIUS_SCALE.map((radius) => (
              <div key={radius.name} className="flex flex-col items-center gap-2">
                <div className={`size-16 bg-accent-indigo/30 ${radius.className}`} />
                <span className="text-xs text-muted-foreground">{radius.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Card Example</h2>
          <PaperCard data={EXAMPLE_PAPER} />
        </section>
      </div>
    </div>
  );
}
