import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {COMMON_CONNECTORS_CATALOG} from '../src/scripts-catalog.js';

const source=await readFile(new URL('../public/assistant/chat.js.txt',import.meta.url),'utf8');
const start=source.indexOf('function renderConnectorsCatalog('),end=source.indexOf('async function loadToolsAndScriptsCatalog(',start);
function element(tag,text='',className=''){return {tag,textContent:text,className,children:[],append(...children){this.children.push(...children);},replaceChildren(){this.children=[];}};}
function setup(canManage){
  const grid=element('div'),badge=element('span'),navigations=[];
  const context=vm.createContext({cachedConnectorsCatalog:[],cachedSecretsForConnectors:[],connectorCatFilter:'all',$:id=>id==='settings-connectors-grid'?grid:badge,node:element,safe:fn=>fn,window:{location:{assign:url=>navigations.push(url)}},openConnectorQuickForm(){throw new Error('Walletbot must use OAuth, not ask for pasted credentials');}});
  vm.runInContext(source.slice(start,end)+';globalThis.render=renderConnectorsCatalog;',context);
  const connector=COMMON_CONNECTORS_CATALOG.find(c=>c.id==='walletbot');
  context.render([{...connector,status:'not-configured',secret_id:null}],[{id:'other',provider:'mcp_server',name:'Other MCP server',status:'verified'}],canManage);
  const walk=node=>[node,...node.children.flatMap(walk)];
  return {nodes:walk(grid),navigations,connector};
}
test('Walletbot card uses its own credential and starts read-only OAuth without key entry',()=>{
  const {nodes,navigations,connector}=setup(true);assert.equal(connector.credential_name,'Walletbot OAuth · čítanie');
  assert.ok(nodes.some(n=>n.textContent==='○ Nepripojené'));
  const button=nodes.find(n=>n.tag==='button'&&n.textContent==='Prihlásiť Walletbot');assert.ok(button);assert.equal(button.disabled,false);button.onclick();
  assert.deepEqual(navigations,['/api/assistant/mcp/oauth/walletbot/start']);
});
test('ordinary users cannot activate the Walletbot connect button',()=>{
  const {nodes,navigations}=setup(false);assert.equal(nodes.find(n=>n.tag==='button'&&n.textContent==='Prihlásiť Walletbot').disabled,true);assert.equal(navigations.length,0);
});
