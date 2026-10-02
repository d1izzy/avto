import { supabase } from "@/lib/supabase";
import { toAppError } from "@/lib/errors";
import type { OwnerBooking, Resource, Service } from "@/types/database";

export async function ownerBookings(slug: string): Promise<OwnerBooking[]> { const { data, error } = await supabase.rpc("owner_list_bookings", { p_slug: slug }); if (error) throw toAppError(error); return data as OwnerBooking[]; }
export async function updateBookingStatus(id: string, status: string) { const { error } = await supabase.rpc("owner_update_booking_status", { p_booking_id: id, p_status: status }); if (error) throw toAppError(error); }
export async function ownerCatalog(slug: string): Promise<{ services: Service[]; resources: Resource[] }> { const { data, error } = await supabase.rpc("owner_catalog", { p_slug: slug }); if (error) throw toAppError(error); return data as { services: Service[]; resources: Resource[] }; }
export async function saveService(slug: string, service: Partial<Service>) { const { error } = await supabase.rpc("owner_upsert_service", { p_slug: slug, p_service: service }); if (error) throw toAppError(error); }
export async function saveResource(slug: string, resource: Partial<Resource>) { const { error } = await supabase.rpc("owner_upsert_resource", { p_slug: slug, p_resource: resource }); if (error) throw toAppError(error); }
