import { describe, expect, it, vi } from "vitest";
import { createIdempotencyKey, durationLabel, money } from "../../src/lib/utils";
describe("formatting",()=>{ it("formats durations",()=>{ expect(durationLabel(30)).toBe("30 мин"); expect(durationLabel(90)).toBe("1 ч 30 мин"); }); it("formats currency",()=>expect(money(1500,"RUB")).toContain("1 500")); it("creates unique idempotency keys",()=>{ vi.unstubAllGlobals(); expect(createIdempotencyKey()).not.toBe(createIdempotencyKey()); }); });
