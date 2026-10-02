import { supabase } from "@/lib/supabase";
import { toAppError } from "@/lib/errors";
import type { AvailabilitySlot, BookingPublic } from "@/types/database";
import type { BookingForm } from "./schema";

export async function getAvailability(slug: string, serviceId: string, date: string): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase.rpc("get_availability", { p_slug: slug, p_service_id: serviceId, p_local_date: date });
  if (error) throw toAppError(error);
  return data as AvailabilitySlot[];
}

export async function createBooking(slug: string, values: BookingForm, idempotencyKey: string) {
  const { data, error } = await supabase.rpc("create_public_booking", {
    p_slug: slug, p_service_id: values.serviceId, p_resource_id: values.resourceId,
    p_requested_start: values.startsAt, p_customer_name: values.customerName,
    p_customer_phone: values.customerPhone, p_customer_email: values.customerEmail || null,
    p_vehicle: { brand: values.vehicleBrand, model: values.vehicleModel, year: values.vehicleYear, license_plate: values.licensePlate },
    p_idempotency_key: idempotencyKey
  });
  if (error) throw toAppError(error);
  return data as { token: string; booking_id: string };
}

export async function getBooking(token: string): Promise<BookingPublic> {
  const { data, error } = await supabase.rpc("get_public_booking", { p_token: token });
  if (error) throw toAppError(error);
  return data as BookingPublic;
}

export async function cancelBooking(token: string) {
  const { error } = await supabase.rpc("cancel_public_booking", { p_token: token });
  if (error) throw toAppError(error);
}

export async function rescheduleBooking(token: string, startsAt: string, resourceId: string) {
  const { error } = await supabase.rpc("reschedule_public_booking", { p_token: token, p_requested_start: startsAt, p_resource_id: resourceId });
  if (error) throw toAppError(error);
}
