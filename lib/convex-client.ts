import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.error("[CONVEX CLIENT] CRITICAL: NEXT_PUBLIC_CONVEX_URL is not set");
  console.error("[CONVEX CLIENT] Available env vars:", Object.keys(process.env).filter(k => k.includes('CONVEX')));
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

console.log("[CONVEX CLIENT] Initializing with URL:", convexUrl.substring(0, 30) + "...");
export const convex = new ConvexHttpClient(convexUrl);
