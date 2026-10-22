import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/assistant/chat.js.txt',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/assistant/chat.html',import.meta.url),'utf8');
test('UI actions work without inline script permission',()=>{
  assert.doesNotMatch(html,/\sonclick\s*=/i);
  assert.doesNotMatch(source,/\sonclick\s*=/i);
  assert.match(source,/\$\('invoice-print-btn'\)\.addEventListener/);
  assert.match(source,/\$\('documents-archive-btn'\)\?\.addEventListener/);
});
test('action locks against duplicate clicks and recovers after failure',async()=>{
  const notices=[];
  const context=vm.createContext({notice:x=>notices.push(x)});
  vm.runInContext(source.slice(source.indexOf('function safe('),source.indexOf('function bubble(')),context);
  let release,calls=0;
  const button={tagName:'BUTTON',disabled:false,setAttribute(){},removeAttribute(){}};
  const action=context.safe(async()=>{calls++;await new Promise(r=>release=r);throw new Error('offline');});
  const event={currentTarget:button,preventDefault(){}};
  const pending=action(event);
  assert.equal(button.disabled,true);
  await action(event);
  assert.equal(calls,1);
  release();await pending;
  assert.equal(button.disabled,false);
  assert.equal(notices.at(-1),'offline');
});
test('wallet load failures reach action error handling',async()=>{
  const notices=[];
  const context=vm.createContext({api:async()=>{throw new Error('HTTP 503');},notice:x=>notices.push(x)});
  vm.runInContext(source.slice(source.indexOf('async function loadWalletView()'),source.indexOf('function renderWalletView(')),context);
  await assert.rejects(context.loadWalletView(),/HTTP 503/);
  assert.match(notices[0],/HTTP 503/);
});
