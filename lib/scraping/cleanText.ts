import type { CheerioAPI } from "cheerio";

// Strips scripts/styles/nav/ads/social-share boilerplate and returns
// continuous readable text, per AGENTS.md §13.
export function extractCleanText($: CheerioAPI, selector: string): string {
  const $el = $(selector).first().clone();
  $el.find("script, style, nav, header, footer, noscript, iframe, form, button").remove();
  $el
    .find('[class*="share"], [class*="newsletter"], [class*="subscribe"], [class*="cookie"]')
    .remove();

  return $el
    .text()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}
