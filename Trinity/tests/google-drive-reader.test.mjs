import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,verify} from 'node:crypto';
import {verifyDriveFile} from '../src/google-drive-reader.js';

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const folder='FixtureFolder01';
const fileId='FixtureFile001';
const env={
  TRINITY_DRIVE_FOLDER_ID:folder,
  TRINITY_DRIVE_SERVICE_ACCOUNT:JSON.stringify({
    type:'service_account',
    client_email:'fixture@example.iam.gserviceaccount.com',
    private_key:privateKey.export({type:'pkcs8',format:'pem'})
  })
};

test('returns proof of bytes read from the selected Drive folder',async()=>{
  const content='{"release":"trinity"}';
  let calls=0;
  const result=await verifyDriveFile(env,fileId,async (url,opts)=>{
    calls++;
    assert.equal(opts.redirect,'manual');
    if (calls===1) {
      assert.equal(url,'https://oauth2.googleapis.com/token');
      const [header,claims,signature]=opts.body.get('assertion').split('.');
      const payload=JSON.parse(Buffer.from(claims,'base64url'));
      assert.equal(payload.scope,'https://www.googleapis.com/auth/drive.readonly');
      assert.equal(payload.sub,undefined);
      assert.ok(verify('RSA-SHA256',Buffer.from(header+'.'+claims),publicKey,Buffer.from(signature,'base64url')));
      return Response.json({access_token:'fixture-token'});
    }
    assert.equal(opts.headers.Authorization,'Bearer fixture-token');
    if (calls===2) return Response.json({id:fileId,name:'release.json',parents:[folder],mimeType:'application/json'});
    assert.match(url,/alt=media/);
    return new Response(content);
  });
  assert.equal(calls,3);
  assert.equal(result.name,'release.json');
  assert.equal(result.sha256,createHash('sha256').update(content).digest('hex'));
  assert.equal(result.bytes,Buffer.byteLength(content));
  assert.equal(result.content,undefined);
});

test('never downloads a file outside the configured folder',async()=>{
  let calls=0;
  await assert.rejects(verifyDriveFile(env,fileId,async()=>{
    if (++calls===1) return Response.json({access_token:'fixture'});
    return Response.json({id:fileId,parents:['OtherFolder01'],mimeType:'application/json'});
  }),{status:404});
  assert.equal(calls,2);
});

test('invalid file IDs and missing configuration trigger no outbound request',async()=>{
  const unused=()=>assert.fail('external request');
  await assert.rejects(verifyDriveFile(env,'../../../test',unused),{status:400});
  await assert.rejects(verifyDriveFile({},fileId,unused),{status:503});
});

test('rejects redirects before forwarding Drive credentials',async()=>{
  let calls=0;
  await assert.rejects(verifyDriveFile(env,fileId,async(url,opts)=>{
    calls++;
    assert.equal(opts.redirect,'manual');
    return new Response(null,{status:302,headers:{Location:'https://example.com/redirect'}});
  }),{status:502,message:/HTTP 302/});
  assert.equal(calls,1);
});
