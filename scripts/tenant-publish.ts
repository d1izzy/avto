import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { loadTenant } from "./tenant-utils";
const slug=process.argv[2]; if(!slug) throw new Error("Usage: npm run tenant:publish -- slug");
const url=process.env.VITE_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error("VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const c=await loadTenant(slug); const db=createClient(url,key,{auth:{persistSession:false}});
const {data,error}=await db.from("tenants").upsert({slug:c.slug,name:c.name,description:c.description,phone:c.phone,email:c.email,address:c.address,timezone:c.timezone,currency:c.currency,accent_color:c.accentColor,status:c.status,hero_url:c.assets.hero},{onConflict:"slug"}).select("id").single();
if(error) throw error; await db.from("tenant_settings").upsert({tenant_id:data.id},{onConflict:"tenant_id"}); console.log(`Published ${c.slug} (${data.id}) without changing operational data.`);
