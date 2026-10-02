import { supabase } from "@/lib/supabase";
import { toAppError } from "@/lib/errors";
import type { OwnerBooking, Resource, Service, Tenant, TenantSettings } from "@/types/database";

export async function ownerBookings(slug: string): Promise<OwnerBooking[]> { const { data, error } = await supabase.rpc("owner_list_bookings", { p_slug: slug }); if (error) throw toAppError(error); return data as OwnerBooking[]; }
export async function updateBookingStatus(id: string, status: string) { const { error } = await supabase.rpc("owner_update_booking_status", { p_booking_id: id, p_status: status }); if (error) throw toAppError(error); }
export async function ownerCatalog(slug: string): Promise<{ services: Service[]; resources: Resource[] }> { const { data, error } = await supabase.rpc("owner_catalog", { p_slug: slug }); if (error) throw toAppError(error); return data as { services: Service[]; resources: Resource[] }; }
export async function saveService(slug: string, service: Partial<Service>) { const { error } = await supabase.rpc("owner_upsert_service", { p_slug: slug, p_service: service }); if (error) throw toAppError(error); }
export async function saveResource(slug: string, resource: Partial<Resource>) { const { error } = await supabase.rpc("owner_upsert_resource", { p_slug: slug, p_resource: resource }); if (error) throw toAppError(error); }

export async function serviceLinks(tenantId: string): Promise<Array<{ service_id: string; resource_id: string }>> {
  const { data, error } = await supabase.from("service_resources").select("service_id,resource_id").eq("tenant_id", tenantId);
  if (error) throw toAppError(error); return data;
}
export async function saveLinkedService(slug: string, tenantId: string, service: Partial<Service>, resourceIds: string[]) {
  if (service.active && !resourceIds.length) throw new Error("Выберите хотя бы один бокс для записи.");
  // New services remain hidden until their boxes are successfully connected.
  const { data: id, error } = await supabase.rpc("owner_upsert_service", { p_slug: slug, p_service: { ...service, ...(!service.id ? { active: false } : {}) } });
  if (error) throw toAppError(error);
  const existing = await serviceLinks(tenantId);
  if (resourceIds.length) {
    const { error: linkError } = await supabase.from("service_resources").upsert(resourceIds.map((resource_id) => ({ tenant_id: tenantId, service_id: id, resource_id })));
    if (linkError) throw toAppError(linkError);
  }
  const removed = existing.filter((l) => l.service_id === id && !resourceIds.includes(l.resource_id)).map((l) => l.resource_id);
  if (removed.length) {
    const { error: unlinkError } = await supabase.from("service_resources").delete().eq("tenant_id", tenantId).eq("service_id", id).in("resource_id", removed);
    if (unlinkError) throw toAppError(unlinkError);
  }
  if (!service.id) await saveService(slug, { id, active: service.active });
}
export async function saveTenant(id: string, values: Partial<Tenant>) {
  const { error } = await supabase.from("tenants").update(values).eq("id", id).select("id").single();
  if (error) throw toAppError(error);
}
export async function saveSettings(id: string, values: Partial<TenantSettings>) {
  const { error } = await supabase.from("tenant_settings").update(values).eq("tenant_id", id).select("tenant_id").single();
  if (error) throw toAppError(error);
}
export async function addGalleryImage(tenantId: string, url: string, alt: string) {
  if (new URL(url).protocol !== "https:") throw new Error("Укажите ссылку HTTPS на изображение.");
  const { error } = await supabase.from("tenant_assets").insert({ tenant_id: tenantId, type: "gallery", storage_path: "external", public_url: url, alt_text: alt });
  if (error) throw toAppError(error);
}
