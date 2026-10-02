import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
const slug=process.argv[2]; if(!slug) throw new Error("Usage: npm run tenant:verify -- slug");
const url=process.env.VITE_SUPABASE_URL; const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY; if(!url||!key) throw new Error("Public Supabase env is required");
const {data,error}=await createClient(url,key).rpc("get_public_tenant",{p_slug:slug}); if(error||!data) throw error??new Error("Tenant unavailable"); console.log(`PASS ${slug}: ${data.services.length} services`);
