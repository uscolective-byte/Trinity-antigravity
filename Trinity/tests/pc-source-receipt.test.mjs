import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceFileResult} from '../src/pc-source-receipt.js';
import {hash} from '../src/security.js';

test('file evidence checks actual UTF-8 content, path, size and digest including empty files',async()=>{
  for(const content of ['', 'Skutočný obsah súboru']){
    const sha256=await hash(content),bytes=new TextEncoder().encode(content).byteLength;
    const action={id:'read-1',status:'completed',receipt:{path:'Trinity/test.txt',content,sha256,bytes}};
    assert.deepEqual(await sourceFileResult(action,'Trinity/test.txt'),{id:'read-1',status:'completed',path:'Trinity/test.txt',content,sha256,bytes});
    await assert.rejects(sourceFileResult({...action,status:'claimed'},'Trinity/test.txt'),/overený obsah/);
    await assert.rejects(sourceFileResult({...action,receipt:{...action.receipt,sha256:'a'.repeat(64)}},'Trinity/test.txt'),/nesúhlasí/);
    await assert.rejects(sourceFileResult({...action,receipt:{...action.receipt,bytes:bytes+1}},'Trinity/test.txt'),/nesúhlasí/);
    await assert.rejects(sourceFileResult(action,'Trinity/other.txt'),/inému súboru/);
  }
  await assert.rejects(sourceFileResult({status:'completed',receipt:{}},'Trinity/test.txt'),/overený obsah/);
});
