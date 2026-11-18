import test from 'node:test';
import assert from 'node:assert/strict';
import {registerExpansion,invokeExpansion} from '../src/universal-expansion-registry.js';

test('declarative extensions persist for the owner and invoke real allowed tools',async()=>{
  const rows=[];
  const ledger=[];
  const env={DB:{prepare(sql){return {
    bind(...args){return {
      async run(){
        if(sql.includes('expansion_registered'))rows.push(JSON.parse(args[0]));
        else if(sql.includes('INSERT INTO ops_sovereign_ledger_v3'))ledger.push(args);
        return {success:true,meta:{changes:1}};
      },
      async first(){
        if(sql.includes('ops_plugins'))return {installed:1,enabled:1};
        if(sql.includes('expansion_registered')){
          const row=rows.find(row=>row.owner===args[0]&&row.definition.id===args[1]);
          return row?{details:JSON.stringify(row)}:null;
        }
        return null;
      }
    };},
    async first(){return null;}
  };}}};
  const request={id:'sum-check',name:'Calculate',steps:[{tool:'calculate',args:{operation:'add',values:[1,2]}}]};
  await assert.rejects(registerExpansion(env,'owner',{...request,handlerCode:'unsupported code'}));
  await assert.rejects(registerExpansion(env,'owner',{...request,steps:[{tool:'pc_run',args:{}}]}));
  const saved=await registerExpansion(env,'owner',request);
  await assert.rejects(invokeExpansion(env,'other',{id:request.id}),{status:404});
  const result=await invokeExpansion(env,'owner',{id:request.id});
  assert.equal(result.revision,saved.revision);
  assert.equal(result.results[0].result.result,3);
  assert.equal(ledger.length,1);
  assert.equal(result.audit_receipt,ledger[0][8]);
});
