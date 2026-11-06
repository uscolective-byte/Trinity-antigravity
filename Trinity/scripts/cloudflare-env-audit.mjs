import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const configFile=fileURLToPath(new URL('../wrangler.jsonc',import.meta.url));

export function sharedMutableBindings(config){
  const staging=config?.env?.staging;
  if(!staging)throw new Error('Staging environment not defined.');
  const categories=[
    ['D1','d1_databases','binding','database_id'],
    ['KV','kv_namespaces','binding','id'],
    ['R2','r2_buckets','binding','bucket_name'],
    ['Vectorize','vectorize','binding','index_name'],
    ['Service','services','binding','service']
  ];
  const collisions=[];
  const productionProfiles=[config,config.env?.production].filter(Boolean);
  for(const [type,key,bindingKey,idKey] of categories){
    const prod=productionProfiles.flatMap(profile=>Array.isArray(profile[key])?profile[key]:[]);
    const dev=Array.isArray(staging[key])?staging[key]:[];
    for(const p of prod){
      const identifier=p[idKey];
      if(!identifier)continue;
      for(const d of dev){
        if(d[idKey]===identifier){
          collisions.push({
            type,
            production_binding:p[bindingKey],
            staging_binding:d[bindingKey],
            shared_resource:true,
            isolation_verified:false
          });
        }
      }
    }
  }
  const productionSecrets=productionProfiles.flatMap(profile=>Array.isArray(profile.secrets_store_secrets)?profile.secrets_store_secrets:[]);
  for(const productionSecret of productionSecrets){
    for(const stagingSecret of Array.isArray(staging.secrets_store_secrets)?staging.secrets_store_secrets:[]){
      if(productionSecret.store_id&&productionSecret.secret_name&&productionSecret.store_id===stagingSecret.store_id&&productionSecret.secret_name===stagingSecret.secret_name){
        collisions.push({
          type:'Secrets Store',
          production_binding:productionSecret.binding,
          staging_binding:stagingSecret.binding,
          shared_resource:true,
          isolation_verified:false
        });
      }
    }
  }
  return collisions;
}

export function reportEnvironmentIsolation(config){
  const collisions=sharedMutableBindings(config);
  return {
    checked:'configuration-only',
    staging:config.env.staging?.name||'unknown',
    production:config.name||'unknown',
    shared_mutable_resources:collisions,
    isolated:collisions.length===0,
    note:collisions.length
      ?'Staging shares mutable resources, service targets, or Secrets Store credentials with production. Provision staging-owned resources and credentials before enabling integrations.'
      :'No shared mutable resources, service targets, or Secrets Store credentials detected in config; live deployment remains unverified.'
  };
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const config=JSON.parse(readFileSync(configFile,'utf8'));
  const report=reportEnvironmentIsolation(config);
  console.log(JSON.stringify(report,null,2));
  if(process.argv.includes('--strict')&&!report.isolated)process.exitCode=2;
}
