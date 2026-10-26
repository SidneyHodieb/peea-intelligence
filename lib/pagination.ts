import { z } from "zod";
const cursorSchema = z.object({ id: z.uuid() }).strict();
export function readPage(params: URLSearchParams) {
  const limit = z.coerce.number().int().min(1).max(100).parse(params.get("limit") ?? 100);
  const raw = params.get("cursor");
  const cursor = raw ? cursorSchema.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))) : null;
  return { limit, cursor };
}
export function nextCursor(id: string) { return Buffer.from(JSON.stringify({ id })).toString("base64url"); }
