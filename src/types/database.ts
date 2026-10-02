export type TenantStatus = "preview" | "live" | "suspended";
export type BookingStatus = "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  currency: string;
  accent_color: string;
  status: TenantStatus;
  hero_url: string | null;
  logo_url: string | null;
}

export interface TenantSettings {
  tenant_id: string;
  booking_enabled: boolean;
  minimum_booking_notice_minutes: number;
  maximum_booking_days: number;
  cancellation_deadline_minutes: number;
  reschedule_enabled: boolean;
  customer_can_cancel: boolean;
  customer_can_reschedule: boolean;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  active: boolean;
  sort_order: number;
}

export interface Resource {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  description: string | null;
  active: boolean;
  capacity: number;
  sort_order: number;
}

export interface PublicTenantBundle {
  tenant: Tenant;
  settings: TenantSettings;
  services: Service[];
  hours: Array<{ weekday: number; start_time: string; end_time: string; active: boolean }>;
  assets: Array<{ type: string; public_url: string; alt_text: string | null; sort_order: number }>;
}

export interface AvailabilitySlot {
  starts_at: string;
  ends_at: string;
  resource_id: string;
  resource_name: string;
}

export interface BookingPublic {
  id: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  price: number;
  currency: string;
  service_name: string;
  resource_name: string;
  tenant_name: string;
  tenant_slug: string;
  address: string | null;
  customer_name: string;
  vehicle: Record<string, unknown>;
  can_cancel: boolean;
  can_reschedule: boolean;
}

export interface OwnerBooking extends BookingPublic {
  customer_phone: string;
  customer_email: string | null;
  created_at: string;
}
