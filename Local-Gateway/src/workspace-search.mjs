import {opendir,lstat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {resolveSafePath,isProtectedWorkspaceSegment} from './policy.mjs';

export const ripgrepBinary=()=>process.env.TRINITY_RG_PATH||(process.platform==='win32'
 ?path.join(os.homedir(),'AppData','Local','Trinity','tools','ripgrep','15.2.0','ripgrep-15.2.0-x86_64-pc-windows-msvc','rg.exe'):'rg');

export async function searchWorkspace(root,payload){
 const mode=payload.mode??'content',base=payload.path??'Trinity',glob=payload.glob??'**/*';
 const limit=payload.limit??50,context=payload.context??0,maxFiles=5000;
 const allowed=new Set(['task','mode','path','glob','limit',...(mode==='content'?['pattern','regex','case_sensitive','context']:[])]);
 if(Object.keys(payload).some(key=>!allowed.has(key))||payload.regex!==undefined&&typeof payload.regex!=='boolean'||payload.case_sensitive!==undefined&&typeof payload.case_sensitive!=='boolean')throw new Error('Neplatné parametre vyhľadávania.');
 if(!['files','content'].includes(mode)||typeof glob!=='string'||glob.length>300||!Number.isInteger(limit)||limit<1||limit>200||!Number.isInteger(context)||context<0||context>3)throw new Error('Neplatné parametre vyhľadávania.');
 if(mode==='content'&&(typeof payload.pattern!=='string'||!payload.pattern.length||payload.pattern.length>2000||payload.pattern.includes('\0')))throw new Error('Chýba platný hľadaný text.');
 if(typeof path.posix.matchesGlob!=='function')throw new Error('Vyhľadávanie vyžaduje Node 22.5 alebo novší.');
 const start=await resolveSafePath(root,base),deadline=Date.now()+10000;
 const files=[],matches=[],reasons=new Set();let visited=0,skippedLarge=0,outputBytes=0;
 async function walk(absolute,relative,depth){
  if(Date.now()>deadline){reasons.add('scan_time_limit');return;}
  if(visited>=maxFiles){reasons.add('file_scan_limit');return;}
  const info=await lstat(absolute);if(info.isSymbolicLink())return;
  if(info.isFile()){
   visited++;
   const display=relative.replaceAll('\\','/');
   const local=path.relative(start,absolute).replaceAll('\\','/')||path.basename(absolute);
   if(!(absolute===start&&glob==='**/*')&&!path.posix.matchesGlob(local,glob))return;
   if(mode==='content'&&info.size>1_000_000){skippedLarge++;return;}
   files.push({absolute,path:display});return;
  }
  if(!info.isDirectory())return;
  if(depth>=20){reasons.add('depth_limit');return;}
  const directory=await opendir(absolute);
  for await(const entry of directory){
   if(isProtectedWorkspaceSegment(entry.name)||entry.isSymbolicLink())continue;
   if(visited>=maxFiles||Date.now()>deadline){reasons.add(visited>=maxFiles?'file_scan_limit':'scan_time_limit');break;}
   const child=path.join(absolute,entry.name),rel=path.join(relative,entry.name);
   // Resolve each directory/file against the existing workspace boundary.
   await resolveSafePath(root,rel);
   await walk(child,rel,depth+1);
  }
 }
 await walk(start,base,0);
 if(skippedLarge)reasons.add('large_files_skipped');
 if(mode==='files'){let bytes=0;const selected=[];for(const file of files){const size=Buffer.byteLength(file.path)+4;if(selected.length>=limit||bytes+size>24000){reasons.add(selected.length>=limit?'result_limit':'output_size_limit');break;}selected.push(file.path);bytes+=size;}return {action:'read',task:'workspace-search',mode,path:base,glob,files:selected,files_scanned:visited,truncated:files.length>limit||reasons.size>0,limit_reasons:[...reasons,...(files.length>limit&&!reasons.has('result_limit')?['result_limit']:[])]};}
 const lookup=new Map(files.map(file=>[path.resolve(file.absolute),file.path]));
 let searched=0;
 for(let offset=0;offset<files.length;){
  if(Date.now()>=deadline){reasons.add('search_time_limit');break;}
  if(reasons.has('output_size_limit'))break;
  if(matches.filter(match=>!match.context).length>=limit){reasons.add('result_limit');break;}
  const batch=[];let chars=0;
  while(offset<files.length&&(batch.length===0||chars+files[offset].absolute.length<12000)){const file=files[offset++];batch.push(file);chars+=file.absolute.length+3;}
  const args=['--no-config','--json','--line-number','--max-filesize','1000000','--max-count',String(limit),'--color','never'];
  if(!payload.regex)args.push('--fixed-strings');if(!payload.case_sensitive)args.push('--ignore-case');if(context)args.push('--context',String(context));
  args.push('--',payload.pattern,...batch.map(file=>file.absolute));
  await new Promise((resolve,reject)=>{
   const child=spawn(ripgrepBinary(),args,{shell:false,windowsHide:true,env:{...process.env,RIPGREP_CONFIG_PATH:''}});
   let buffer='',stderr='',limited=false,done=false;
   const timer=setTimeout(()=>{child.kill();finish(new Error('Vyhľadávanie prekročilo časový limit.'));},Math.max(1,deadline-Date.now()));
   function finish(error){if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve();}
   function line(text){
    if(!text||limited)return;
    const event=JSON.parse(text);if(!['match','context'].includes(event.type))return;
    const record=event.data,absolute=record.path?.text;
    if(!absolute||!lookup.has(path.resolve(absolute)))throw new Error('Vyhľadávač vrátil nepovolenú cestu.');
    if(typeof record.lines?.text!=='string'){reasons.add('non_utf8_result_skipped');return;}
    const row={path:lookup.get(path.resolve(absolute)),line:record.line_number,text:record.lines.text.replace(/[\r\n]+$/,'').slice(0,1600),text_truncated:record.lines.text.length>1600,context:event.type==='context',columns_byte:(record.submatches||[]).slice(0,10).map(match=>match.start+1)};
    const size=Buffer.byteLength(JSON.stringify(row));if(outputBytes+size>24000){limited=true;reasons.add('output_size_limit');child.kill();return;}outputBytes+=size;matches.push(row);
    if(matches.filter(match=>!match.context).length>=limit){limited=true;reasons.add('result_limit');child.kill();}
   }
   child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
   child.stdout.on('data',chunk=>{try{buffer+=chunk.toString('utf8');if(buffer.length>8_000_000)throw new Error('Výstup vyhľadávača je príliš veľký.');let end;while((end=buffer.indexOf('\n'))>=0){const text=buffer.slice(0,end);buffer=buffer.slice(end+1);line(text);}}catch(error){child.kill();finish(error);}});
   child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString('utf8')).slice(-4000);});
   child.on('error',()=>finish(new Error('Samostatný ripgrep nie je dostupný. Nainštaluj nástroj pre PC bránu.')));
   child.on('close',code=>{try{if(buffer.trim()&&!limited)line(buffer);if(!limited&&code!==0&&code!==1)throw new Error('Vyhľadávanie zlyhalo: '+stderr);finish();}catch(error){finish(error);}});
  });
  searched+=batch.length;
 }
 return {action:'read',task:'workspace-search',mode,path:base,glob,pattern:payload.pattern,regex:payload.regex===true,case_sensitive:payload.case_sensitive===true,matches,files_scanned:visited,files_selected:files.length,files_submitted:searched,search_performed:searched>0,coverage:files.length===0?'no_candidate_files':reasons.size?'limited':'selected_files',...(files.length===0?{guidance:'Filter nevybral žiadne súbory; obsah nebol prehľadaný. Over glob a cestu, bez požiadavky na príponu použi **/*.'}:{}),skipped_large_files:skippedLarge,truncated:reasons.size>0,limit_reasons:[...reasons]};
}
