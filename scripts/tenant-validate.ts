import { allTenants } from "./tenant-utils";
const tenants=await allTenants(); const slugs=new Set<string>();
for (const tenant of tenants) { if(slugs.has(tenant.slug)) throw new Error(`Duplicate slug: ${tenant.slug}`); slugs.add(tenant.slug); console.log(`PASS ${tenant.slug}`); }
console.log(`Validated ${tenants.length} tenant(s).`);
