import "server-only";

const SCHEDULER_BASE_URL = "https://data.oxylabs.io/v1/schedules";
const RESULTS_BASE_URL = "https://data.oxylabs.io/v1";

function authHeader(): string {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;
  if (!username || !password) {
    throw new Error("Oxylabs credentials are not configured");
  }
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

// Oxylabs schedule/job/run IDs are 64-bit integers that exceed
// Number.MAX_SAFE_INTEGER. JSON.parse silently corrupts them, so every ID must
// be read from the raw response text via regex before any JSON.parse call.
// See AGENTS.md section 18.
function extractStringField(rawText: string, field: string): string | null {
  const match = rawText.match(new RegExp(`"${field}"\\s*:\\s*(\\d+)`));
  return match ? match[1] : null;
}

function extractAllStringFields(rawText: string, field: string): string[] {
  const matches = rawText.matchAll(new RegExp(`"${field}"\\s*:\\s*(\\d+)`, "g"));
  return Array.from(matches, (m) => m[1]);
}

export interface CreateScheduleResult {
  scheduleId: string;
  active: boolean;
  cron: string;
  nextRunAt: string | null;
}

export async function createSchedule(
  listingUrl: string,
  cron: string,
  endTimeIso: string
): Promise<CreateScheduleResult> {
  const response = await fetch(SCHEDULER_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      cron,
      items: [{ source: "universal", url: listingUrl, render: "html" }],
      end_time: endTimeIso,
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Oxylabs create schedule failed (${response.status}): ${rawText}`);
  }

  const scheduleId = extractStringField(rawText, "schedule_id");
  if (!scheduleId) throw new Error(`Oxylabs create schedule response missing schedule_id: ${rawText}`);

  const parsed = JSON.parse(rawText) as { active: boolean; cron: string; next_run_at: string | null };
  return { scheduleId, active: parsed.active, cron: parsed.cron, nextRunAt: parsed.next_run_at };
}

export async function listOxylabsScheduleIds(): Promise<string[]> {
  const response = await fetch(SCHEDULER_BASE_URL, {
    headers: { Authorization: authHeader() },
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Oxylabs list schedules failed (${response.status}): ${rawText}`);
  }

  return extractAllStringFields(rawText, "schedule_id").length > 0
    ? extractAllStringFields(rawText, "schedule_id")
    : extractAllStringFields(rawText, "schedules");
}

export async function setScheduleActive(scheduleId: string, active: boolean): Promise<void> {
  const response = await fetch(`${SCHEDULER_BASE_URL}/${scheduleId}/state`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({ active }),
  });

  if (!response.ok) {
    const rawText = await response.text();
    throw new Error(`Oxylabs set schedule state failed (${response.status}): ${rawText}`);
  }
}

export interface ScheduleRunJob {
  id: string;
  resultStatus: string;
}

export interface ScheduleRun {
  runId: string;
  jobs: ScheduleRunJob[];
}

export async function getScheduleRuns(scheduleId: string): Promise<ScheduleRun[]> {
  const response = await fetch(`${SCHEDULER_BASE_URL}/${scheduleId}/runs`, {
    headers: { Authorization: authHeader() },
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Oxylabs get runs failed (${response.status}): ${rawText}`);
  }

  // Split the raw text into per-run chunks by "run_id" occurrences so job IDs
  // and their result_status stay associated with the correct run, all while
  // still reading every integer ID from raw text rather than JSON.parse.
  const runIdMatches = Array.from(rawText.matchAll(/"run_id"\s*:\s*(\d+)/g));
  const runs: ScheduleRun[] = [];

  for (let i = 0; i < runIdMatches.length; i++) {
    const runId = runIdMatches[i][1];
    const start = runIdMatches[i].index ?? 0;
    const end = i + 1 < runIdMatches.length ? (runIdMatches[i + 1].index ?? rawText.length) : rawText.length;
    const chunk = rawText.slice(start, end);

    const jobIds = Array.from(chunk.matchAll(/"id"\s*:\s*(\d+)/g)).map((m) => m[1]);
    const statuses = Array.from(chunk.matchAll(/"result_status"\s*:\s*"([^"]*)"/g)).map((m) => m[1]);

    const jobs: ScheduleRunJob[] = jobIds.map((id, idx) => ({
      id,
      resultStatus: statuses[idx] ?? "unknown",
    }));

    runs.push({ runId, jobs });
  }

  return runs;
}

export async function getJobResultHtml(jobId: string): Promise<string> {
  const response = await fetch(`${RESULTS_BASE_URL}/queries/${jobId}/results`, {
    headers: { Authorization: authHeader() },
  });

  if (!response.ok) {
    const rawText = await response.text();
    throw new Error(`Oxylabs get job result failed (${response.status}): ${rawText}`);
  }

  const data = await response.json();
  const result = data?.results?.[0];
  if (!result) throw new Error(`Oxylabs job ${jobId} returned no result`);
  return result.content as string;
}
