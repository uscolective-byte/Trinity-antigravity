import {readFile,readdir,mkdir,mkdtemp,writeFile,realpath,rm} from 'node:fs/promises';
import {resolve,relative,isAbsolute,basename,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';

const executeFile=promisify(execFile);
const registryColumns=['tool_id','name','category','description','input_schema','output_schema','handler_type','handler_target','enabled','avg_latency_ms','success_count','error_count','last_used','created_at'];
const digest=value=>createHash('sha256').update(value).digest('hex');
function maskNonCode(sql){
  let state='code',masked='';
  for(let index=0;index<sql.length;index++){
    const value=sql[index],next=sql[index+1];
    if(state==='code'){
      if(value==='-'&&next==='-'){state='line';masked+='  ';index++;}
      else if(value==='/'&&next==='*'){state='block';masked+='  ';index++;}
      else if(value==="'"||value==='"'||value==='`'){state=value;masked+=' ';}
      else if(value==='['){state=']';masked+=' ';}
      else masked+=value;
    }else if(state==='line'){
      if(value==='\n'||value==='\r'){state='code';masked+=value;}else masked+=' ';
    }else if(state==='block'){
      if(value==='*'&&next==='/'){state='code';masked+='  ';index++;}
      else masked+=value==='\n'||value==='\r'?value:' ';
    }else{
      masked+=value==='\n'||value==='\r'?value:' ';
      if(value===state){if(next===state){masked+=' ';index++;}else state='code';}
    }
  }
  return masked;
}
function defaultValue(value){
  if(value===null||value===undefined)return null;
  let text=String(value).trim();
  while(/^\((?:[-+]?\d+|'(?:[^']|'')*'|NULL)\)$/i.test(text))text=text.slice(1,-1).trim();
  return /^NULL$/i.test(text)?null:text;
}
function verifyExistingColumn(column,type,tail,table,name){
  const spec=tail.trim().match(/^(NOT\s+NULL\s*)?(?:DEFAULT\s+(NULL|[-+]?\d+|'(?:[^']|'')*'))?$/i);
  if(!spec||String(column.type).toUpperCase()!==type.toUpperCase()||Boolean(column.notnull)!==Boolean(spec[1])||defaultValue(column.dflt_value)!==defaultValue(spec[2])){
    throw new Error(`Existing ${table}.${name} does not match the migration type, nullability or literal default; explicit repair is required.`);
  }
}

// Only already-present ADD COLUMN operations with verified equivalent metadata
// are omitted. All other SQL, including trigger bodies, is kept byte-for-byte.
export async function planCompatibleMigrations(files,applied,columnsForTable){
  const cache=new Map();
  const columns=async table=>{if(!cache.has(table))cache.set(table,await columnsForTable(table));return cache.get(table);};
  const registry=await columns('trinity_tool_registry');
  if(registry.length){
    const missing=registryColumns.filter(name=>!registry.some(column=>column.name===name));
    if(missing.length)throw new Error('Unsupported tool registry layout; missing runtime columns: '+missing.join(', '));
  }
  const plan=[];
  for(const file of files){
    if(applied.has(file.name))continue;
    const skipped=[];
    const pattern=/^[\t ]*ALTER[\t ]+TABLE[\t ]+([A-Za-z_][A-Za-z0-9_]*)[\t ]+ADD[\t ]+COLUMN[\t ]+([A-Za-z_][A-Za-z0-9_]*)[\t ]+([A-Za-z]+)([^\r\n]*);[\t ]*(?:--[^\r\n]*)?$/gmi;
    let sql='',offset=0;
    for(const codeMatch of maskNonCode(file.sql).matchAll(pattern)){
      const original=file.sql.slice(codeMatch.index,codeMatch.index+codeMatch[0].length);
      const parsed=new RegExp(pattern.source,'i').exec(original);
      if(!parsed)continue;
      const match=Object.assign(parsed,{index:codeMatch.index});
      const [,table,name,type,tail]=match;
      const existing=(await columns(table)).find(column=>column.name.toLowerCase()===name.toLowerCase());
      sql+=file.sql.slice(offset,match.index);
      if(existing){verifyExistingColumn(existing,type,tail,table,name);skipped.push({table,column:name,reason:'equivalent existing column verified'});sql+=`-- Existing column verified: ${table}.${name}`;}
      else sql+=match[0];
      offset=match.index+match[0].length;
    }
    sql+=file.sql.slice(offset);
    if(skipped.length&&!sql.replace(/^[\t ]*--[^\r\n]*$/gm,'').trim())sql+='\n-- All schema effects already verified above.\nSELECT 1;\n';
    plan.push({name:file.name,sql,skipped,source_sha256:digest(file.sql),effective_sha256:digest(sql)});
  }
  return plan;
}

export async function runCompatibleMigrations(args){
  if(args.length!==2||!args.includes('--remote')||!args.some(arg=>['--check','--apply'].includes(arg)))throw new Error('Use compatible-migrations.mjs --remote --check|--apply');
  const apply=args.includes('--apply'),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const config=JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8'));
  const database=config.d1_databases?.find(binding=>binding.binding==='DB');
  if(!database?.database_id||!/^[a-f0-9-]{36}$/i.test(database.database_id)||!config.account_id)throw new Error('The production DB binding and account must be configured explicitly.');
  if(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_ACCOUNT_ID!==config.account_id)throw new Error('Cloudflare account override differs from the reviewed project account.');
  const table=database.migrations_table||'d1_migrations';
  if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table))throw new Error('Unsupported migration tracking table name.');
  const cli=join(root,'node_modules/wrangler/bin/wrangler.js');
  const wrangler=async argv=>executeFile(process.execPath,[cli,...argv],{cwd:root,env:process.env,timeout:180000,maxBuffer:4*1024*1024});
  const query=async sql=>{
    const result=await wrangler(['d1','execute','DB','--remote','--config','wrangler.jsonc','--env=','--command',sql,'--json']);
    const responses=JSON.parse(result.stdout);
    if(!Array.isArray(responses)||responses.some(item=>item.success!==true))throw new Error('D1 metadata query was not successful.');
    return responses.flatMap(item=>item.results||[]);
  };
  const exists=await query(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`);
  const applied=new Set(exists.length?(await query(`SELECT name FROM ${table}`)).map(row=>row.name):[]);
  const migrationRoot=resolve(root,database.migrations_dir||'migrations');
  const names=(await readdir(migrationRoot)).filter(name=>/^\d+_[A-Za-z0-9_-]+\.sql$/.test(name)).sort();
  const files=await Promise.all(names.map(async name=>({name,sql:await readFile(join(migrationRoot,name),'utf8')})));
  const plan=await planCompatibleMigrations(files,applied,tableName=>query(`PRAGMA table_info('${tableName}')`));
  const summary={mode:apply?'apply':'check',account_id:config.account_id,database_id:database.database_id,pending:plan.map(({sql,...metadata})=>metadata),verified_existing_columns:plan.flatMap(item=>item.skipped.map(column=>({migration:item.name,...column})))};
  if(!apply||!plan.length)return {...summary,applied:[],verified_complete:plan.length===0};
  const cacheRoot=join(root,'.wrangler');await mkdir(cacheRoot,{recursive:true});
  const temporary=await mkdtemp(join(cacheRoot,'migration-compat-'));
  try{
    const directory=join(temporary,'migrations');await mkdir(directory);
    for(const item of plan)await writeFile(join(directory,item.name),item.sql);
    const temporaryConfig=join(temporary,'wrangler.json');
    await writeFile(temporaryConfig,JSON.stringify({name:'trinity-migration-compat',account_id:config.account_id,compatibility_date:config.compatibility_date,d1_databases:[{binding:'DB',database_name:database.database_name,database_id:database.database_id,migrations_table:table,migrations_dir:directory}]}));
    // Wrangler owns transactional application and writes its normal migration ledger.
    // A nonzero status is never downgraded to a warning.
    await wrangler(['d1','migrations','apply','DB','--remote','--config',temporaryConfig,'--env=']);
    const recorded=new Set((await query(`SELECT name FROM ${table}`)).map(row=>row.name));
    if(plan.some(item=>!recorded.has(item.name)))throw new Error('A migration is missing its completion record.');
    const pendingNames=new Set(plan.map(item=>item.name));
    const checked=await planCompatibleMigrations(files.filter(file=>pendingNames.has(file.name)),new Set(),tableName=>query(`PRAGMA table_info('${tableName}')`));
    const verifiedColumns=new Set(checked.flatMap(item=>item.skipped.map(column=>column.table+'.'+column.column)));
    if(plan.some(item=>item.skipped.some(column=>!verifiedColumns.has(column.table+'.'+column.column))))throw new Error('An adopted column no longer exists after application.');
    return {...summary,applied:plan.map(item=>item.name),verified_complete:true};
  }finally{
    const base=await realpath(cacheRoot),target=await realpath(temporary),child=relative(base,target);
    if(!child||child.startsWith('..')||isAbsolute(child)||!basename(target).startsWith('migration-compat-'))throw new Error('Refusing to clean an unverified migration directory.');
    await rm(target,{recursive:true,force:true});
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(await runCompatibleMigrations(process.argv.slice(2)),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
