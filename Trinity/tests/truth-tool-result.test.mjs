import test from 'node:test';
import assert from 'node:assert/strict';
import {findUnsupportedActionClaims} from '../src/truth.js';
import {runAgent} from '../src/engine.js';
const text='Výsledok nástroja calculate je: 42';
test('named tool result requires a successful receipt for the same tool',()=>{
  for(const receipts of [[],[{tool:'calculate',status:'failed',receipt_id:'failed'}],[{tool:'calculate',status:'completed'}],[{tool:'service_status',status:'completed',receipt_id:'other'}]]){
    assert.deepEqual(findUnsupportedActionClaims(text,receipts),['tool_result:calculate']);
  }
  assert.deepEqual(findUnsupportedActionClaims(text,[{tool:'calculate',status:'completed',receipt_id:'actual-calculator'}]),[]);
});
test('English named result and backtick name are checked without blocking ordinary arithmetic',()=>{
  assert.deepEqual(findUnsupportedActionClaims('The result of tool `calculate` is: 42',[]),['tool_result:calculate']);
  assert.deepEqual(findUnsupportedActionClaims('17 + 25 = 42.',[]),[]);
  assert.deepEqual(findUnsupportedActionClaims('Nemám overený výsledok nástroja calculate.',[]),[]);
});
test('engine cannot escape the truth check by removing JSON from a fabricated result',async()=>{
  const result=await runAgent({AI:{run:async()=>({response:text})}},'orchestrator','Daj výsledok pomenovaného nástroja bez volania.','','fast');
  assert.equal(result.tool_log.length,0);
  assert.match(result.text,/Nemám overený dôkaz/);
  assert.doesNotMatch(result.text,/Výsledok nástroja calculate je/);
});
