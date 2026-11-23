import {readdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
async function walk(dir,prefix=''){
  const result=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const name=prefix+entry.name;
    if(entry.isDirectory())result.push(...await walk(new URL(entry.name+'/',dir),name+'/'));
    else result.push(name);
  }
  return result.sort();
}
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(root),encoding:'utf8'}).trim();
const sections=[`# Trinity: Complete Source Module Index\n\nGenerated from source at commit \`${sha}\`. The working tree may contain uncommitted edits; this index is not proof of deployment or live service connectivity.\n\nRe-run: \`node scripts/build-owner-reference.mjs\`. The export list is a static index, not a list of enabled tools. Active permissions and schemas are queried via the authorized catalog.\n`];
for(const base of ['src','services']){
  sections.push(`## ${base}: every source module\n`);
  for(const name of (await walk(new URL(base+'/',root))).filter(n=>/\.(?:m?js|ts)$/.test(n))){
    const source=await readFile(new URL(base+'/'+name,root),'utf8');
    const names=[...source.matchAll(/export\s+(?:(?:async|default)\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
    sections.push(`<details>\n<summary>${base}/${name}</summary>\n\n[Open source](../${base}/${name})\n\nExported interfaces: ${names.length?names.map(n=>'`'+n+'`').join(', '):'module without directly declared named exports; inspect source and re-exports'}.\n\n</details>\n`);
  }
}
sections.push('## Database Migrations\n\nListing migration files does not confirm they have been applied to the production database.\n');
for(const name of await walk(new URL('migrations/',root)))sections.push(`- [${name}](../migrations/${name})`);
const index=await readFile(new URL('src/index.js',root),'utf8');
const routes=[...new Set([...index.matchAll(/path\s*===\s*(['"])(\/[^'"\n]+)\1/g)].map(m=>m[2]))].sort();
sections.push('\n## Literal Routes in Main Router\n\nStatic extraction from `src/index.js`; dynamic regex routes and nested routers are documented in their respective modules. Route presence does not confirm authorization or live integration.\n');
for(const route of routes)sections.push('- `'+route+'`');
await writeFile(new URL('docs/SOURCE_REFERENCE.md',root),sections.join('\n')+'\n');
console.log(JSON.stringify({source_commit:sha,routes:routes.length,output:'docs/SOURCE_REFERENCE.md'}));
