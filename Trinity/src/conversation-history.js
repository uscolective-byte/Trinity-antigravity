import {usableModelText} from './services.js';

export async function loadConversationHistory(env,sessionId,jobId,opts={}) {
  const limit=Math.max(1,Math.min(20,Number.isInteger(opts?.limit)?opts.limit:4));
  const maxChars=Math.max(200,Math.min(6000,Number.isInteger(opts?.maxChars)?opts.maxChars:1600));
  const rows=await env.DB.prepare(`SELECT task,substr(result,1,${maxChars}) AS result FROM ops_jobs WHERE session_id=? AND id<>? AND status='completed' ORDER BY created_at DESC,rowid DESC LIMIT ${limit}`).bind(sessionId,jobId).all();
  return rows.results.filter(row=>usableModelText(row.result||'') && !/m[oô]j zoznam n[aá]strojov/i.test(row.result||'')).reverse();
}

export function conversationsToMessages(rows=[]) {
  const msgs=[];
  for(const row of Array.isArray(rows)?rows:[]){
    const userText=String(row?.task||'').trim();
    const assistantText=String(row?.result||'').trim();
    if(userText)msgs.push({role:'user',content:userText});
    if(assistantText)msgs.push({role:'assistant',content:assistantText});
  }
  return msgs;
}
