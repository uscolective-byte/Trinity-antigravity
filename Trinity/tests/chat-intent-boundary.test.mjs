import test from 'node:test';
import assert from 'node:assert/strict';
import {directChatTool} from '../src/fast-chat.js';

test('explicit repository status uses GitHub while pasted reports remain contextual',()=>{
 assert.equal(directChatTool('Skontroluj stav repozitára',['github_manage'])?.name,'github_manage');
 for(const message of [
   'Overím repozitár Trinity-antigravity, prečítam pravidlá spolupráce a vyhľadám nastavenia MCP. Pokračuj v úlohe.',
   'Antigravity potvrdil ACK do TEAM-HANDOFF.md. GitHub repo je prepojené. Môžeš pokračovať v oprave chatu.',
   'Vysvetli tento kód a oprav zobrazenie správ.',
   'Prečítaj subory a navrhni zlepšenie komunikácie.'
 ])assert.equal(directChatTool(message,['github_manage']),null);
});
