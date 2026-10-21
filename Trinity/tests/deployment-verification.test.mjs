import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verificationTarget,verifyDeployment} from '../scripts/verify-deployment.mjs';
const id='863ecc84-3985-4aea-9114-fdc18b723555';
const commit='a'.repeat(40);
const config={origin:'https://auru.space',expectedVersionId:id,version:'10.3.0',attempts:1};
const fake=(health={},ready={})=>async url=>Response.json(url.endsWith('/health')?{version:'10.3.0',environment:'production',deployment:{id,tag:null},...health}:{version:'10.3.0',environment:'production',ready:true,...ready});
test('deployment verifier accepts a real version receipt when Workers Builds has no commit tag',async()=>{
 const target=verificationTarget(['https://auru.space','--version-id',id]);assert.equal(target.expectedVersionId,id);
 assert.equal((await verifyDeployment({...config,fetcher:fake()})).verified,true);
 await assert.rejects(verifyDeployment({...config,expectedVersionId:undefined,expectedTag:commit,fetcher:fake()}),/verification failed/);
});
test('deployment verification requires readiness, correct environment, package version and deployment',async()=>{
 for(const [health,ready] of [[{version:'old'},{}],[{environment:'development'},{}],[{deployment:{id:crypto.randomUUID()}},{}],[{},{ready:false}],[{},{environment:'development'}],[{},{version:'old'}]])await assert.rejects(verifyDeployment({...config,fetcher:fake(health,ready)}),/verification failed/);
});
test('deployment CLI preserves commit-tag verification and rejects ambiguous or arbitrary targets',async()=>{
 assert.deepEqual(verificationTarget(['https://auru.dev',commit]),{origin:'https://auru.dev',expectedTag:commit});
 assert.equal((await verifyDeployment({...config,expectedVersionId:undefined,expectedTag:commit,fetcher:fake({deployment:{id,tag:commit}})})).verified,true);
 for(const args of [['https://evil.example',commit],['https://auru.space','--version-id','bad'],['https://auru.space',commit,'extra'],['https://auru.space','short']])assert.throws(()=>verificationTarget(args));
});
