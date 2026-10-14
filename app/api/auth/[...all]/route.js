import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request) {
  return toNextJsHandler(getAuth()).POST(request);
}
