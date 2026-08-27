const READ_WORDS_PER_MINUTE = 200;

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatReadTime(rawText: string): string {
  const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / READ_WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

const KIND_LABELS: Record<string, string> = {
  repo: "GitHub repo",
  dataset: "Dataset",
  model: "Model",
  newsletter: "Newsletter",
  video: "Video",
  paper: "Paper",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? "Paper";
}
