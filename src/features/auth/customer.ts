import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toAppError } from "@/lib/errors";
import { savedBookings } from "@/features/booking/local-bookings";
import type { BookingPublic, CustomerProfile } from "@/types/database";

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>();
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);
  return session;
}
export async function claimBooking(token: string) {
  const { error } = await supabase.rpc("customer_claim_booking", { p_token: token }); if (error) throw toAppError(error);
}
export async function accountBookings(slug: string) {
  // A local capability proves access; email or phone matching never does.
  const claims = await Promise.allSettled(savedBookings(slug).map(claimBooking));
  const { data, error } = await supabase.rpc("customer_saved_bookings", { p_slug: slug });
  if (error) throw toAppError(error);
  return { bookings: data as Array<{ token: string; booking: BookingPublic }>, syncFailed: claims.some((c) => c.status === "rejected") };
}
export async function getProfile(userId: string): Promise<CustomerProfile | null> {
  const { data, error } = await supabase.from("customer_profiles").select("name,phone,vehicle_brand,vehicle_model,license_plate").eq("user_id", userId).maybeSingle();
  if (error) throw toAppError(error); return data;
}
export async function saveProfile(userId: string, profile: CustomerProfile) {
  const { error } = await supabase.from("customer_profiles").upsert({ ...profile, user_id: userId }); if (error) throw toAppError(error);
}
