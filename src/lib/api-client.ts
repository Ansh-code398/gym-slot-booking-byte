import { treaty } from "@elysiajs/eden";
import type { App } from "@/server/app";

const baseUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const client = treaty<App>(baseUrl);
export const api = client.api;
