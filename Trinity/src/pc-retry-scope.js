import {hash} from './security.js';

// This identity only links argument-validation attempts. Execution failures
// and uncertain mutations retain their ordinary, stricter receipt identity.
export async function pcRetryScope(tool,input){
 const operations={pc_find_files:'find',pc_search_text:'search',pc_file_read:'read',pc_fs_read:'read',read_file:'read',pc_file_edit:'edit',pc_fs_patch:'edit',edit_file:'edit',pc_file_write:'write',pc_fs_write:'write',write_file:'write',pc_file_append:'append',pc_run_script:'script',pc_run:'run',pc_shell_exec:'run',run_command:'run'};
 const operation=operations[tool];
 if(!operation||!input||typeof input!=='object'||Array.isArray(input))return null;
 const fields={};
 for(const [key,value] of Object.entries(input)){
  const normalized=key.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(Object.hasOwn(fields,normalized)&&JSON.stringify(fields[normalized])!==JSON.stringify(value))return null;
  fields[normalized]=value;
 }
 const pick=(...keys)=>{const values=keys.filter(key=>fields[key]!==undefined).map(key=>fields[key]);return values.length&&values.every(value=>JSON.stringify(value)===JSON.stringify(values[0]))?values[0]:undefined;};
 let identity;
 if(operation==='run'){
  const command=pick('command','commandline');
  if(typeof command!=='string'||!command)return null;
  identity={operation,command,cwd:fields.cwd||'Trinity'};
 }else{
  const path=pick('path','filepath')??(['find','search'].includes(operation)?'Trinity':undefined);
  if(typeof path!=='string'||!path)return null;
  if(operation==='find')identity={operation,path,glob:fields.glob||'**/*',limit:fields.limit??50};
  if(operation==='search'){const pattern=pick('pattern','query');if(typeof pattern!=='string')return null;identity={operation,path,pattern,glob:fields.glob||'**/*',regex:fields.regex??false,case_sensitive:fields.casesensitive??false,context:fields.context??0,limit:fields.limit??50};}
  if(operation==='read')identity={operation,path,start:fields.startline,end:fields.endline,offset:fields.byteoffset,depth:fields.depth};
  if(operation==='edit'){
   const find=pick('find','target'),replace=pick('replace','replacement');
   if(typeof find!=='string'||typeof replace!=='string')return null;
   identity={operation,path,find,replace};
  }
  if(operation==='write'||operation==='append'){
   if(typeof fields.content!=='string')return null;
   identity={operation:fields.append?'append':operation,path,content:fields.content};
  }
  if(operation==='script'){
   if(typeof fields.runtime!=='string'||fields.args!==undefined&&!Array.isArray(fields.args))return null;
   identity={operation,path,runtime:fields.runtime,args:fields.args||[]};
  }
 }
 return hash(JSON.stringify(identity));
}
