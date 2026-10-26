import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readPage, nextCursor } from "../lib/pagination";
import { GET } from "../app/api/v1/events/route";
const execute = vi.hoisted(() => vi.fn());
vi.mock("../lib/supabase-server", () => ({ mapEventRow: (row: unknown) => row, getSupabaseAdmin: () => ({ from: () => {
  const query: any = { select: () => query, gte: () => query, eq: vi.fn(() => query), order: () => query, limit: () => query, lt: vi.fn(() => query), then: (yes: any, no: any) => execute(query).then(yes,no) }; return query;
} }) }));
describe("pagination", () => {
  it("validates limits and opaque UUID cursors before building filters", () => {
    const id = "c9c37b27-1eef-4943-a12c-cd9455159c43";
    expect(readPage(new URLSearchParams({ limit: "50", cursor: nextCursor(id) }))).toEqual({ limit: 50, cursor: { id } });
    for (const limit of ["0","-1","101","NaN","1.5"]) expect(() => readPage(new URLSearchParams({ limit }))).toThrow();
    expect(() => readPage(new URLSearchParams({ cursor: "invalid" }))).toThrow();
  });
  it("returns the extra-row cursor and applies city before limiting", async () => {
    const ids = ["ffffffff-ffff-4fff-8fff-ffffffffffff","eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","dddddddd-dddd-4ddd-8ddd-dddddddddddd"];
    execute.mockImplementationOnce(async query => { expect(query.eq).toHaveBeenCalledWith("data->>city", "Lyon"); return { data: ids.map(id => ({ id })), error: null }; });
    const first = await GET(new NextRequest("https://example.org/api/v1/events?limit=2&city=Lyon"));
    const body = await first.json(); expect(body.data).toHaveLength(2);
    execute.mockImplementationOnce(async query => { expect(query.lt).toHaveBeenCalledWith("id",ids[1]); return { data: [{ id: ids[2] }], error: null }; });
    const second = await GET(new NextRequest(`https://example.org/api/v1/events?limit=2&cursor=${body.meta.next_cursor}`));
    const next = await second.json(); expect(next.data).toEqual([{ id: ids[2] }]); expect(next.meta.next_cursor).toBeNull();
  });
});
