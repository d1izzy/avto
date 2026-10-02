import { supabase } from "@/lib/supabase";
import { toAppError } from "@/lib/errors";
import type { PublicTenantBundle } from "@/types/database";

export async function getPublicTenant(slug: string): Promise<PublicTenantBundle> {
  const { data, error } = await supabase.rpc("get_public_tenant", { p_slug: slug });
  if (error) throw toAppError(error);
  return data as PublicTenantBundle;
}
