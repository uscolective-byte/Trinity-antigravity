import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {searchWorkspace} from '../src/workspace-search.mjs';

async function fixture(fn){const root=await mkdtemp(path.join(os.tmpdir(),'trinity-search-'));try{await mkdir(path.join(root,'Trinity/src'),{recursive:true});await writeFile(path.join(root,'Trinity/src/main.js'),'// žltý súbor\nexport function sample(){return 42;}\n');await writeFile(path.join(root,'Trinity/.dev.vars'),'HIDDEN_TEST_VALUE=sample');await mkdir(path.join(root,'Trinity/node_modules'));await writeFile(path.join(root,'Trinity/node_modules/hidden.js'),'sample');await fn(root);}finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}}

test('search finds real file names and Unicode text lines while protecting credential and dependency paths',async()=>fixture(async root=>{
 const files=await searchWorkspace(root,{mode:'files',glob:'**/*.js'});assert.deepEqual(files.files,['Trinity/src/main.js']);
 const hits=await searchWorkspace(root,{pattern:'žltý'});assert.equal(hits.matches[0].line,1);assert.match(hits.matches[0].text,/žltý súbor/);
 const regex=await searchWorkspace(root,{pattern:'function\\s+sample',regex:true});assert.equal(regex.matches[0].line,2);
 const protectedFiles=await searchWorkspace(root,{mode:'files',glob:'**/.*'});assert.deepEqual(protectedFiles.files,[]);
 await assert.rejects(searchWorkspace(root,{path:'Trinity/.dev.vars',pattern:'sample'}),/chránená/);
 await assert.rejects(searchWorkspace(root,{path:'../outside',pattern:'sample'}),/chránená|mimo/);
}));

test('search distinguishes zero matches, regex errors and explicit result limits',async()=>fixture(async root=>{
 assert.deepEqual((await searchWorkspace(root,{pattern:'not_present'})).matches,[]);
 await assert.rejects(searchWorkspace(root,{pattern:'[',regex:true}),/Vyhľadávanie zlyhalo/);
 await writeFile(path.join(root,'Trinity/src/many.txt'),'needle\n'.repeat(20));
 const limited=await searchWorkspace(root,{pattern:'needle',limit:2});assert.equal(limited.matches.length,2);assert.equal(limited.truncated,true);assert.ok(limited.limit_reasons.includes('result_limit'));
 const literal=await searchWorkspace(root,{path:'Trinity/src/main.js',pattern:'sample(){'});assert.equal(literal.matches.length,1);
}));

test('search omits links pointing outside the workspace',async()=>fixture(async root=>{
 const outside=await mkdtemp(path.join(os.tmpdir(),'trinity-search-outside-'));
 try{await writeFile(path.join(outside,'private.txt'),'outside-marker');await symlink(outside,path.join(root,'Trinity/link'),process.platform==='win32'?'junction':'dir');assert.equal((await searchWorkspace(root,{pattern:'outside-marker'})).matches.length,0);}finally{await rm(outside,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}));


test('search reports excluded large files and bounds serialized result output',async()=>fixture(async root=>{
 await writeFile(path.join(root,'Trinity/src/large.txt'),'x'.repeat(1_000_001));
 const large=await searchWorkspace(root,{pattern:'not_present'});assert.equal(large.skipped_large_files,1);assert.ok(large.limit_reasons.includes('large_files_skipped'));
 await writeFile(path.join(root,'Trinity/src/output.txt'),('needle'+'x'.repeat(1700)+'\n').repeat(100));
 const bounded=await searchWorkspace(root,{pattern:'needle',limit:200});assert.ok(bounded.matches.length>0);assert.ok(bounded.limit_reasons.includes('output_size_limit'));assert.ok(Buffer.byteLength(JSON.stringify(bounded))<32000);
}));
