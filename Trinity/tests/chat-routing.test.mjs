import test from 'node:test';
import assert from 'node:assert/strict';
import {selectChatProvider} from '../src/chat-routing.js';
test('ordinary conversation uses fast inference',()=>assert.equal(selectChatProvider('auto','Ahoj, ako sa máš?'),'fast'));
test('repair and PC tasks stay with the cloud planner',()=>{for(const message of ['Oprav chybu v aplikácii','Spusti program na mojom PC'])assert.equal(selectChatProvider('auto',message),'workers-ai');});
test('explicit engines remain explicit',()=>{assert.equal(selectChatProvider('local','Ahoj'),'local');assert.equal(selectChatProvider('gemini','Ahoj'),'gemini');assert.equal(selectChatProvider('cloud','Ahoj'),'workers-ai');});
