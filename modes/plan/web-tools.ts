import Firecrawl from "@mendable/firecrawl-js";
import { tool } from "ai";
import { z } from "zod";
import { ActionTracker } from "../agent/action-tracker";

let client: Firecrawl | null = null;
function getClient() {
  if (!client) {
    client = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
  }
  return client;
};

function clip(s: string, n = 8000): string {
  return s.length > n ? s.slice(0, n) + "\n...[truncated]" : s;
};

export function createWebTools(tracker: ActionTracker) {
  return {

    /* tool --- search the web */
    web_search: tool({
      description: " search the web, returns title/url/snippet list.",

      inputSchema: z.object({
        query: z.string().describe("search query").min(1),
        limit: z.number().int().min(1).max(10).optional().default(5),
      }),

      execute: async ({ query, limit }) => {
        const res = await getClient().search(query, {
          limit,
          sources: ["web"],
        });
        const items = (res.web ?? []).slice(0, limit);

        const formatted =
          items
            .map((item, i) => {
              const title =
                ("title" in item && item.title) || `Result ${i + 1}`;
              const url = ("url" in item && item.url) || "";
              const snippet = ("snippet" in item && item.snippet) || "";
              return `${i + 1}. ${title}\n${url}\n${snippet}`;
            })
            .join("\n\n") || "No web search results.";

        tracker.log({
          type: "tool_execute",
          path: `web_search: ${query}`,
          details: { after: formatted, toolName: "web_search" },
          status: "executed",
        });

        return clip(formatted);
      },
    }),

    /* tool --- fetch url */
    fetch_url: tool({
      description: "HTTP GET for a URL. Returns response body.",
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => {
        const r = await fetch(url, { redirect: "follow" });
        const body = await r.text();
        const out = clip(body, 16_000);
        tracker.log({
          type: "code_analysis",
          path: `fetch:${url}`,
          details: {
            after: `HTTP ${r.status}\n\n${out}`,
            toolName: "fetch_url",
          },
          status: "executed",
        });
        return `HTTP ${r.status}\n\n${out}`;
      },
    }),

    /* tool --- web crawl */
    web_crawl: tool({
      description: "Scrape a URL into markdown text.",
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => {
        const doc = await getClient().scrape(url, { formats: ["markdown"] });
        const md = (doc as { markdown?: string }).markdown ?? "";
        tracker.log({
          type: "code_analysis",
          path: `web_crawl:${url}`,
          details: { after: clip(md), toolName: "web_crawl" },
          status: "executed",
        });
        return clip(md) || "(empty)";
      },
    }),


  };
};
