import { z } from "zod";
export const tenantSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: z.string().min(2), description: z.string().min(10),
  phone: z.string().min(7), email: z.string().email(), address: z.string().min(5), timezone: z.string().refine((value) => { try { Intl.DateTimeFormat(undefined,{timeZone:value}); return true; } catch { return false; } }, "Invalid timezone"),
  currency: z.string().regex(/^[A-Z]{3}$/), accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), status: z.enum(["preview","live"]),
  assets: z.object({ hero: z.string().url(), icon: z.string().min(1) })
});
export type TenantConfig = z.infer<typeof tenantSchema>;
