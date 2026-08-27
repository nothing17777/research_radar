import "server-only";

const OXYLABS_REALTIME_URL = "https://realtime.oxylabs.io/v1/queries";

export interface OxylabsScrapeResult {
  content: string;
  statusCode: number;
  url: string;
}

async function scrapeUrlLocal(url: string): Promise<OxylabsScrapeResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Local fetch failed for ${url}: ${response.status}`);
  }

  return {
    content: await response.text(),
    statusCode: response.status,
    url: response.url || url,
  };
}

export async function scrapeUrl(url: string, opts?: { render?: "html" }): Promise<OxylabsScrapeResult> {
  if (process.env.NODE_ENV === "development") {
    return scrapeUrlLocal(url);
  }

  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;
  if (!username || !password) {
    throw new Error("Oxylabs credentials are not configured");
  }

  const response = await fetch(OXYLABS_REALTIME_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    },
    body: JSON.stringify({
      source: "universal",
      url,
      render: opts?.render ?? "html",
    }),
  });

  if (!response.ok) {
    throw new Error(`Oxylabs request failed for ${url}: ${response.status}`);
  }

  const data = await response.json();
  const result = data?.results?.[0];
  if (!result) {
    throw new Error(`Oxylabs returned no result for ${url}`);
  }

  return {
    content: result.content as string,
    statusCode: result.status_code as number,
    url: (result.url as string) ?? url,
  };
}
