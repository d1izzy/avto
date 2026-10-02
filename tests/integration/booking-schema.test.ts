import { describe, expect, it } from "vitest";
import { bookingSchema } from "../../src/features/booking/schema";
import { toAppError } from "../../src/lib/errors";

const booking = {
  serviceId: "20000000-0000-0000-0000-000000000001",
  resourceId: "30000000-0000-0000-0000-000000000001",
  startsAt: "2026-10-23T10:00:00+00:00",
  customerName: "Test Client",
  customerPhone: "+79990001122",
  customerEmail: "",
  vehicleBrand: "Volvo",
  vehicleModel: "XC60",
  licensePlate: "123123"
};

describe("booking confirmation validation", () => {
  it("accepts the existing PostgreSQL seed IDs and Supabase timestamp", () => {
    expect(bookingSchema.parse(booking)).toEqual(booking);
  });

  it("also accepts generated version 4 UUIDs", () => {
    expect(bookingSchema.safeParse({ ...booking, serviceId: crypto.randomUUID(), resourceId: crypto.randomUUID() }).success).toBe(true);
  });

  it.each(["2026-10-23T10:00:00Z", "2026-10-23T15:00:00+05:00", "2026-10-23T10:00:00.123456+00:00"])("accepts explicit timezone: %s", (startsAt) => {
    expect(bookingSchema.safeParse({ ...booking, startsAt }).success).toBe(true);
  });

  it.each(["serviceId", "resourceId"])("rejects malformed %s", (field) => {
    const result = bookingSchema.safeParse({ ...booking, [field]: "not-an-id" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual([field]);
  });

  it("rejects timezone-less timestamps", () => {
    expect(bookingSchema.safeParse({ ...booking, startsAt: "2026-10-23T15:00:00" }).success).toBe(false);
  });

  it("retains validation for customer and vehicle fields", () => {
    const result = bookingSchema.safeParse({ ...booking, customerName: "", vehicleModel: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path[0])).toEqual(["customerName", "vehicleModel"]);
  });
});

describe("Supabase error messages", () => {
  it("shows the slot conflict message for a PostgREST error object", () => {
    const error = toAppError({ code: "P0001", message: "BOOKING_SLOT_UNAVAILABLE", details: null });
    expect(error.code).toBe("BOOKING_SLOT_UNAVAILABLE");
    expect(error.message).toContain("Выберите другой интервал");
  });

  it("does not reveal unexpected database details", () => {
    expect(toAppError({ message: "sensitive internal database detail" }).message).not.toContain("sensitive");
  });
});
