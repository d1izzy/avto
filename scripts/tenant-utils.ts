import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { tenantSchema, type TenantConfig } from "./tenant-schema";
export async function loadTenant(slug: string): Promise<TenantConfig> { const file=path.resolve("config","tenants",slug,"business.json"); return tenantSchema.parse(JSON.parse(await readFile(file,"utf8"))); }
export async function allTenants() { const root=path.resolve("config","tenants"); const dirs=await readdir(root,{withFileTypes:true}); return Promise.all(dirs.filter((d)=>d.isDirectory()).map((d)=>loadTenant(d.name))); }
