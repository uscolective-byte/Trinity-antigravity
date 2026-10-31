import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Compare Wrangler D1 binding IDs to an account-level, read-only D1 inventory.
 * Does not create, delete, execute SQL, change configuration, or read secrets.
 *
 * Wrangler 10181 alone is not proof that a database was deleted: the
 * deployments API has also returned this error for existing databases.
 */
export function diagnoseD1Bindings(config,inventory,{environment='staging'}={}){
  const bindings=environment==='production'
    ?config?.d1_databases:config?.env?.[environment]?.d1_databases;
  if(!Array.isArray(bindings))throw new Error('Unknown Wrangler environment or missing D1 bindings.');
  const databases=Array.isArray(inventory)?inventory:
    Array.isArray(inventory?.result)?inventory.result:
    Array.isArray(inventory?.databases)?inventory.databases:null;
  if(!databases)throw new Error('D1 inventory must be a JSON array returned by Wrangler d1 list --json.');
  const rows=databases.filter(x=>x&&typeof x==='object').map(x=>({
    id:String(x.uuid||x.id||x.database_id||'').toLowerCase(),
    name:String(x.name||x.database_name||'')
  }));
  const results=bindings.map(binding=>{
    const configuredId=String(binding.database_id||'').toLowerCase();
    const idMatch=rows.find(r=>r.id===configuredId);
    const nameMatch=rows.find(r=>r.name===binding.database_name);
    return {
      binding:binding.binding,
      configured_database_name:binding.database_name,
      configured_database_id:configuredId,
      visible_in_account:!!idMatch,
      current_id_for_name:nameMatch?.id||null,
      status:!uuid.test(configuredId)?'invalid_config_id':
        idMatch&&idMatch.name===binding.database_name?'matched':
        idMatch?'name_mismatch':
        nameMatch?'name_exists_with_different_id':'database_id_not_visible',
      safe_to_deploy_by_inventory:!!idMatch&&idMatch.name===binding.database_name
    };
  });
  return {
    environment,
    check:'cloudflare-d1-metadata-only',
    verified_against_account_inventory:true,
    safe_to_deploy_by_inventory:results.every(x=>x.safe_to_deploy_by_inventory),
    resources:results,
    modified_resources:false,
    note:'Matching account inventory does NOT guarantee Cloudflare Workers upload will succeed (10181 can occur despite an existing database).'
  };
}

function parseArgs(argv){
  const args={environment:'staging',inventory:null,live:false};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--env')args.environment=argv[++i];
    else if(argv[i]==='--inventory')args.inventory=argv[++i];
    else if(argv[i]==='--live')args.live=true;
    else if(argv[i]==='--help')args.help=true;
    else throw new Error('Unknown argument. Use --help.');
  }
  if(args.inventory&&args.live)throw new Error('Choose either --inventory or --live.');
  if(!['staging','production'].includes(args.environment))throw new Error('Use --env staging or --env production.');
  return args;
}
function liveInventory(){
  // This fixed command only lists account D1 metadata; it does not mutate.
  const cli=process.platform==='win32'?'npx.cmd':'npx';
  const res=spawnSync(cli,['--no-install','wrangler','d1','list','--json'],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),
    shell:process.platform==='win32',
    encoding:'utf8',timeout:45000,windowsHide:true,maxBuffer:1024*1024,
    stdio:['ignore','pipe','pipe']
  });
  if(res.error||res.status!==0)throw new Error('Wrangler D1 inventory unavailable. Check account login, token scope, installed Wrangler and network without printing tokens.');
  try{return JSON.parse(res.stdout);}catch{throw new Error('Wrangler D1 list did not return valid JSON; no cloud resource was changed.');}
}
function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.help){
    process.stdout.write('Usage: node scripts/d1-binding-doctor.mjs --live [--env staging|production]\n'+
      '   or: node scripts/d1-binding-doctor.mjs --inventory <wrangler-d1-list.json> [--env staging|production]\n');
    return;
  }
  if(!args.live&&!args.inventory)throw new Error('Use --live for remote D1 metadata, or --inventory with a saved Wrangler JSON list.');
  const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  const inventory=args.live?liveInventory():JSON.parse(readFileSync(args.inventory,'utf8'));
  const report=diagnoseD1Bindings(config,inventory,{environment:args.environment});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(!report.safe_to_deploy_by_inventory)process.exitCode=2;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{main();}catch(error){
    // Never dump the CLI stderr or other strings potentially containing credentials.
    process.stderr.write('D1 preflight blocked: '+String(error.message).replace(/(?:cfat_|sk-|ghp_)[A-Za-z0-9_-]+/g,'[redacted]')+'\n');
    process.exitCode=2;
  }
}
