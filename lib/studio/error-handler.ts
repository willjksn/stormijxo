/**
 * Central error handler for Premium Studio API routes.
 */

import { NextResponse } from "next/server";

export function handleApiError(err: unknown, fallbackMessage = "Something went wrong."): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  const safe = message.slice(0, 200);
  console.error("[Premium Studio]", err);
  return NextResponse.json({ error: safe || fallbackMessage }, { status: 500 });
}

/** Structured error for 4xx/5xx with code, message, and optional details. */
export function structuredError(params: {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  status?: number;
}): NextResponse {
  const status = params.status ?? 400;
  return NextResponse.json(
    {
      error: params.code,
      message: params.message,
      ...(params.details && Object.keys(params.details).length > 0 ? { details: params.details } : {}),
    },
    { status }
  );
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized(message = "Unauthorized."): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden."): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function rateLimitResponse(retryAfter?: number): NextResponse {
  const res = NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  if (typeof retryAfter === "number" && retryAfter > 0) {
    res.headers.set("Retry-After", String(Math.ceil(retryAfter / 1000)));
  }
  return res;
}
