import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCommand,receipt} from './protocol.mjs';
const valid=()=>({id:'12345678-1234-1234-1234-123456789abc',deviceId:'android_123456',action:'file.create',payload:{path:'Trinity/hello.txt',content:'hello'},expiresAt:Date.now()+30000});
test('valid command accepted',()=>assert.equal(validateCommand(valid()).action,'file.create'));
test('path traversal rejected',()=>assert.throws(()=>validateCommand({...valid(),payload:{path:'../secret',content:'x'}}),/Unsafe/));
test('expired command rejected',()=>assert.throws(()=>validateCommand({...valid(),expiresAt:Date.now()-1}),/Expired/));
test('unsupported action rejected',()=>assert.throws(()=>validateCommand({...valid(),action:'shell.execute'}),/Unsupported/));
test('receipt does not imply verification',()=>assert.equal(receipt(valid(),'approved').status,'approved'));
