import { supabase } from "@/lib/supabase";
import { toAppError } from "@/lib/errors";
import type { Customer, ScheduleException, OwnerBooking, Resource, Service, Tenant, TenantAsset, TenantSettings } from "@/types/database";

export async function ownerBookings(slug: string): Promise<OwnerBooking[]> { const { data, error } = await supabase.rpc("owner_list_bookings", { p_slug: slug }); if (error) throw toAppError(error); return data as OwnerBooking[]; }
export async function updateBookingStatus(id: string, status: string) { const { error } = await supabase.rpc("owner_update_booking_status", { p_booking_id: id, p_status: status }); if (error) throw toAppError(error); }
export async function ownerCatalog(slug: string): Promise<{ services: Service[]; resources: Resource[] }> { const { data, error } = await supabase.rpc("owner_catalog", { p_slug: slug }); if (error) throw toAppError(error); return data as { services: Service[]; resources: Resource[] }; }
export async function saveService(slug: string, service: Partial<Service>) { const { error } = await supabase.rpc("owner_upsert_service", { p_slug: slug, p_service: service }); if (error) throw toAppError(error); }
export async function saveResource(slug: string, resource: Partial<Resource>) {
  const tenant = await supabase.from("tenants").select("id").eq("slug", slug).single();
  if (tenant.error) throw toAppError(tenant.error);
  const request = resource.id ? supabase.from("resources").update(resource).eq("id", resource.id).eq("tenant_id", tenant.data.id) : supabase.from("resources").insert({ ...resource, tenant_id: tenant.data.id });
  const { error } = await request.select("id").single(); if (error) throw toAppError(error);
}
export async function deleteService(slug: string, id: string): Promise<"deleted" | "archived"> { const { data, error } = await supabase.rpc("owner_delete_service", { p_slug: slug, p_service_id: id }); if (error) throw toAppError(error); return (data as { action: "deleted" | "archived" }).action; }
export async function deleteResource(slug: string, id: string): Promise<"deleted" | "archived"> { const { data, error } = await supabase.rpc("owner_delete_resource", { p_slug: slug, p_resource_id: id }); if (error) throw toAppError(error); return (data as { action: "deleted" | "archived" }).action; }
export async function deleteAsset(slug: string, id: string) { const { error } = await supabase.rpc("owner_delete_asset", { p_slug: slug, p_asset_id: id }); if (error) throw toAppError(error); }
export async function replaceHours(slug: string, hours: Array<{ weekday: number; start_time: string; end_time: string; active: boolean }>) { const { error } = await supabase.rpc("owner_replace_hours", { p_slug: slug, p_hours: hours }); if (error) throw toAppError(error); }
export async function ownerAssets(tenantId: string): Promise<TenantAsset[]> { const { data, error } = await supabase.from("tenant_assets").select("id,tenant_id,type,storage_path,public_url,alt_text,sort_order").eq("tenant_id", tenantId).order("sort_order"); if (error) throw toAppError(error); return data as TenantAsset[]; }

export async function serviceLinks(tenantId: string): Promise<Array<{ service_id: string; resource_id: string }>> {
  const { data, error } = await supabase.from("service_resources").select("service_id,resource_id").eq("tenant_id", tenantId);
  if (error) throw toAppError(error); return data;
}
export async function saveLinkedService(slug: string, _tenantId: string, service: Partial<Service>, resourceIds: string[]) {
  if (service.active && !resourceIds.length) throw new Error("Выберите хотя бы один бокс для записи.");
  const { error } = await supabase.rpc("owner_save_service", { p_slug: slug, p_service: service, p_resources: resourceIds });
  if (error) throw toAppError(error);
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

export async function restoreItem(table: "services" | "resources" | "customers" | "bookings", tenantId: string, id: string) {
  const { error } = await supabase.from(table).update({ deleted_at: null }).eq("tenant_id", tenantId).eq("id", id).select("id").single();
  if (error) throw toAppError(error);
}
export async function saveOwnerBooking(slug: string, booking: Record<string, unknown>, original?: OwnerBooking) {
  // Contact-only edits preserve the duration/price snapshot of the original visit,
  // even if the studio has since changed the service duration.
  if (original && original.service_id === booking.service_id && original.resource_id === booking.resource_id && original.starts_at === booking.starts_at && original.status === booking.status) {
    const { error } = await supabase.from("bookings").update({
      customer_name_snapshot: String(booking.customer_name).trim(), customer_phone_snapshot: String(booking.customer_phone).trim(),
      customer_email_snapshot: booking.customer_email || null, vehicle_snapshot: booking.vehicle, price: booking.price,
      updated_at: new Date().toISOString()
    }).eq("id", original.id).eq("starts_at", original.starts_at).eq("ends_at", original.ends_at).eq("service_id", original.service_id).eq("resource_id", original.resource_id).eq("status", original.status).select("id").single();
    if (error) throw toAppError(error); return original.id;
  }
  const { data, error } = await supabase.rpc("owner_save_booking", { p_slug: slug, p_booking: booking });
  if (error) throw toAppError(error); return data as string;
}
export async function archiveBooking(slug: string, id: string) {
  const { error } = await supabase.rpc("owner_archive_booking", { p_slug: slug, p_id: id }); if (error) throw toAppError(error);
}
export async function ownerCustomers(tenantId: string): Promise<Customer[]> {
  const { data, error } = await supabase.from("customers").select("id,tenant_id,name,phone,email,deleted_at").eq("tenant_id", tenantId).order("name");
  if (error) throw toAppError(error); return data;
}
export async function saveCustomer(tenantId: string, customer: Partial<Customer>) {
  const { error } = await supabase.from("customers").upsert({ ...customer, tenant_id: tenantId }).select("id").single();
  if (error) throw toAppError(error);
}
export async function archiveCustomer(tenantId: string, id: string) {
  const { error } = await supabase.from("customers").update({ deleted_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("id", id).select("id").single();
  if (error) throw toAppError(error);
}
export async function ownerExceptions(tenantId: string): Promise<ScheduleException[]> {
  const { data, error } = await supabase.from("schedule_exceptions").select("*").eq("tenant_id", tenantId).order("date");
  if (error) throw toAppError(error); return data;
}
export async function saveException(tenantId: string, item: Partial<ScheduleException>) {
  const { error } = await supabase.from("schedule_exceptions").upsert({ ...item, tenant_id: tenantId, type: item.start_time ? "block" : "closed" }).select("id").single();
  if (error) throw toAppError(error);
}
export async function deleteException(tenantId: string, id: string) {
  const { error } = await supabase.from("schedule_exceptions").delete().eq("tenant_id", tenantId).eq("id", id); if (error) throw toAppError(error);
}
export async function saveAsset(tenantId: string, asset: Partial<TenantAsset>) {
  if (!asset.public_url || new URL(asset.public_url).protocol !== "https:") throw new Error("Укажите ссылку HTTPS на изображение.");
  const { error } = await supabase.from("tenant_assets").upsert({ ...asset, tenant_id: tenantId, type: "gallery", storage_path: asset.storage_path || "external" }).select("id").single();
  if (error) throw toAppError(error);
}
export async function uploadImage(tenantId: string, file: File) {
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const ext = extensions[file.type];
  if (!ext || file.size > 10 * 1024 * 1024) throw new Error("Выберите JPG, PNG или WebP размером до 10 МБ.");
  const path = `${tenantId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("tenant-assets").upload(path, file, { contentType: file.type });
  if (error) throw toAppError(error);
  return { storage_path: path, public_url: supabase.storage.from("tenant-assets").getPublicUrl(path).data.publicUrl };
}
