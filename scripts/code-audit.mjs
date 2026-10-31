#!/usr/bin/env node
// Syntax inventory of tracked JS/JSON and exact duplicate candidates.
// The audit never imports project code, deletes files, or modifies source.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,extname,relative,isAbsolute,sep} from 'node:path';
import {createHash} from 'node:crypto';

const DEFAULT_ROOT=fileURLToPath(new URL('../',import.meta.url));
const JS=new Set(['.js','.mjs','.cjs']);
const JSON_EXT=new Set(['.json']);
const OTHER_SOURCE=new Set(['.jsonc','.ts','.tsx','.jsx','.py','.ps1','.psm1','.sh','.bash','.go','.rs','.java','.sol','.css','.html','.vue','.svelte','.toml','.yaml','.yml']);

function trackedFiles(root){
  const result=spawnSync('git',['-C',root,'ls-files','-z'],{encoding:'buffer',maxBuffer:32*1024*1024,timeout:45000,windowsHide:true});
  if(result.error||result.status!==0)throw Error('Unable to list tracked files from Git. No source changes made.');
  return result.stdout.toString('utf8').split('\0').filter(Boolean).sort();
}
export function auditTrackedSource(root=DEFAULT_ROOT,{node=process.execPath}={}){
  const location=resolve(root),paths=trackedFiles(location);
  const report={schema:1,root:'<git-working-tree>',tracked_files:paths.length,checked_js:0,checked_json:0,other_source_files:0,not_syntax_checked:[],errors:[],duplicate_groups:[],deletion_performed:false};
  const hashes=new Map();
  for(const path of paths){
    const full=resolve(location,path),rel=relative(location,full);
    if(isAbsolute(rel)||rel.startsWith('..'+sep)||rel==='..'){
      report.errors.push({path,kind:'invalid_path'});continue;
    }
    const ext=extname(path).toLowerCase();
    if(!JS.has(ext)&&!JSON_EXT.has(ext)&&!OTHER_SOURCE.has(ext))continue;
    let data;
    try{data=readFileSync(full);}catch{report.errors.push({path,kind:'unreadable_file'});continue;}
    // A repeated SHA-256 is a human review hint only; dynamic consumers
    // and scripts might still depend on both files.
    if(data.length>0){
      const digest=createHash('sha256').update(data).digest('hex');
      if(!hashes.has(digest))hashes.set(digest,[]);
      hashes.get(digest).push(path);
    }
    if(JS.has(ext)){
      report.checked_js++;
      const run=spawnSync(node,['--check',full],{stdio:'ignore',timeout:12000,windowsHide:true});
      if(run.error||run.status!==0)report.errors.push({path,kind:'javascript_syntax_error_or_timeout'});
    }else if(JSON_EXT.has(ext)){
      report.checked_json++;
      try{JSON.parse(data.toString('utf8'));}catch{report.errors.push({path,kind:'json_parse_error'});}
    }else{
      report.other_source_files++;
      report.not_syntax_checked.push(path);
    }
  }
  report.duplicate_groups=[...hashes.values()].filter(group=>group.length>1).sort((a,b)=>a[0].localeCompare(b[0]));
  report.checked_total=report.checked_js+report.checked_json;
  report.ok=report.errors.length===0;
  return report;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),rootArg=args.indexOf('--root');
  const root=rootArg>=0?args[rootArg+1]:DEFAULT_ROOT;
  if(!root){process.stderr.write('Missing --root directory.\n');process.exitCode=2;}
  else{
    try{
      const result=auditTrackedSource(root);
      if(args.includes('--json'))process.stdout.write(JSON.stringify(result,null,2)+'\n');
      else{
        process.stdout.write('Tracked: '+result.tracked_files+'; JS checked: '+result.checked_js+'; JSON checked: '+result.checked_json+'; other source not syntax checked: '+result.other_source_files+'; identical groups: '+result.duplicate_groups.length+'; errors: '+result.errors.length+'\n');
        for(const item of result.errors)process.stdout.write('ERROR '+item.kind+': '+item.path+'\n');
        process.stdout.write('No deletion performed. Review duplicate candidates and unsupported extensions before changing code.\n');
      }
      if(args.includes('--strict')&&!result.ok)process.exitCode=1;
    }catch{
      process.stderr.write('Unable to audit the Git working tree.\n');process.exitCode=2;
    }
  }
}
