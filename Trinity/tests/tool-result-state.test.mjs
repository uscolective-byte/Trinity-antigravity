import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toolResultState} from '../src/lib/tool-result-state.js';
import {ToolExecutor} from '../src/lib/trinity-tool-executor.js';
import {Dispatcher} from '../src/services/dispatcher.js';

test('completion requires explicit terminal evidence and rejects contradictory acceptance', () => {
  const response={ok:true,status:200};
  for(const output of [{},null,[],{success:true,status:'unknown'},{success:true,verified:false}]) {
    assert.equal(toolResultState(response,output),'unverified');
  }
  for(const status of ['pending','queued','running','awaiting_approval']) {
    assert.equal(toolResultState(response,{success:true,status}),status);
  }
  assert.equal(toolResultState({...response,status:202},{success:true}),'unverified');
  assert.equal(toolResultState(response,{status:'completed',error:'failed'}),'error');
  assert.equal(toolResultState(response,{status:'completed'}),'success');
});

for(const kind of ['executor','dispatcher']) {
  test(`${kind} stops a real pipeline on a pending provider response without success receipt`,async()=>{
    let calls=0,receipts=0,stats=0;
    const binding={fetch:async(url)=>{assert.equal(new URL(url).pathname,'/tool/first');calls++;return Response.json({success:true,status:'running',job_id:'job-1'});}};
    const tool={handler_target:'CORE'};
    let runner;
    if(kind==='executor') {
      runner=new ToolExecutor({DB:{prepare:()=>({bind:()=>({first:async()=>({status:'running'})})})},CORE:binding});
      runner._createRun=async()=>'test-run';
      runner._finishRun=async()=>{};
      runner.getToolDefinition=async()=>tool;
      runner._writeReceipt=async()=>{receipts++;return true;};
      runner._updateToolStats=async()=>{stats++;};
    }else{
      runner=new Dispatcher({CORE:binding},{getTool:async()=>tool,log:async()=>{},recordToolSuccess:async()=>{receipts++;},recordToolError:async()=>{stats++;}});
      runner.lifecycle.db={prepare:()=>({bind:()=>({first:async()=>({status:'running'})})})};
      runner.lifecycle._createRun=async()=>'test-run';
      runner.lifecycle._finishRun=async()=>{};
    }
    const result=await runner.executePipeline([{tool:'first'},{tool:'second'}]);
    assert.equal(result.completed,false);
    assert.equal(result.results[0].status,'running');
    assert.equal(result.results[0].output.job_id,'job-1');
    assert.equal(calls,1);
    assert.equal(receipts,0);
    assert.equal(stats,0);
    assert.equal(result.results[0].receipt_id,undefined);
  });
}
