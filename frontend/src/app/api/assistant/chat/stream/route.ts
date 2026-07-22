/**
 * Next.js API Route that proxies the streaming chat endpoint
 * without buffering, enabling real-time text delivery to the client.
 */

import { NextRequest } from "next/server";

// Force dynamic to prevent Next.js from caching/statically optimizing this streaming route
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const authorization = req.headers.get("authorization") || "";

  const backendResponse = await fetch(`${BACKEND_URL}/api/assistant/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authorization,
    },
    body,
  });

  if (!backendResponse.ok) {
    return new Response(backendResponse.statusText, {
      status: backendResponse.status,
    });
  }

  // Pipe the backend stream directly to the client without buffering
  return new Response(backendResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
