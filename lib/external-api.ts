import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ExternalWriteError } from "./external-enrichment";

export function authorizeExternal(request: Request) {
  const token = process.env.EXTERNAL_API_TOKEN ?? process.env.INTERNAL_API_TOKEN;
  if (!token) return { response: NextResponse.json({ error: { code: "AUTH_NOT_CONFIGURED" } }, { status: 503 }) };
  if (!hasExternalAuthorization(request)) return { response: NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }) };
  return { actor: createHash("sha256").update(token).digest("hex") };
}

export function hasExternalAuthorization(request: Request) {
  const token = process.env.EXTERNAL_API_TOKEN ?? process.env.INTERNAL_API_TOKEN;
  if (!token) return false;
  const expected = createHash("sha256").update(`Bearer ${token}`).digest();
  const actual = createHash("sha256").update(request.headers.get("authorization") ?? "").digest();
  return timingSafeEqual(expected, actual);
}

export async function externalJson(request: Request) {
  // Enforce actual bytes, not only the caller-controlled Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new ExternalWriteError("INVALID_JSON", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 2_100_000) { await reader.cancel(); throw new ExternalWriteError("PAYLOAD_TOO_LARGE", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ExternalWriteError("INVALID_JSON", 400); }
}

export function externalError(cause: unknown) {
  const requestId = randomUUID();
  if (cause instanceof ExternalWriteError) return NextResponse.json({ error: { code: cause.code, requestId: cause.requestId } }, { status: cause.status });
  console.error("external_api_failed", { requestId, cause });
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", requestId } }, { status: 500 });
}
