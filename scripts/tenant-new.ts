import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const slug=process.argv[2];
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Usage: npm run tenant:new -- valid-slug");
const dir=path.resolve("config","tenants",slug); await mkdir(dir,{recursive:false});
const config={slug,name:"New Service",description:"Describe this service business.",phone:"+1 555 000 0000",email:"owner@example.com",address:"Business address",timezone:"UTC",currency:"USD",accentColor:"#D7FF3F",status:"preview",assets:{hero:"https://images.unsplash.com/photo-1487754180451-c456f719a1fc",icon:"/icon.svg"}};
await writeFile(path.join(dir,"business.json"),JSON.stringify(config,null,2)+"\n"); console.log(`Created config/tenants/${slug}/business.json`);
