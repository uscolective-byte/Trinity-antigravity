/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module planner.js (Trinity/src/planner.js) in the TRINITY OMNI-CORE ecosystem.
 */
const normalize=(text)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('sk');
const has=(text,patterns)=>patterns.some(pattern=>text.includes(pattern));

export function planTask(task, ownerMode = false){
  const text=normalize(task);
  const repair=has(text,['oprav','problem','chyba','nejde','nefunguje','vyleps','diagnost','fix','error','bug','broken','diagnos']);
  const intent=repair?'repair'
    :has(text,['vyhlada','hladaj','zdroj','aktualne','spravy','over','research','search','news','verify'])?'research'
    :has(text,['vytvor','vybuduj','naprogram','web','aplikac','kod','implement','build','create','code'])?'build'
    :has(text,['obrazok','obrazky','ilustrac','grafik','video','hudb','image','illustration','music'])?'creative'
    :has(text,['nasad','zmen','uprav','vymaz','odosli','spusti','prihlas','heslo','domenu','worker','deploy','delete'])?'action'
    :has(text,['analyz','porovnaj','vysvetli','preskumaj','skontroluj','compare','explain','inspect'])?'analysis':'conversation';
  const risk=has(text,['vymaz','zmaz','heslo','prihlas','platb','peniaze','nasad','deploy','domenu','delete','password','payment'])?'high'
    :has(text,['zmen','uprav','odosli','spusti','vytvor','vybuduj','naprogram','modify','create','build'])?'medium':'low';
  const steps=repair?['diagnose actual state and root cause of the problem','apply the smallest reversible fix within the requested scope','on failure, switch to a safe alternative or skip optional step','run an appropriate test and record the verified receipt']
    :intent==='research'?['clarify the question and time scope','search and compare credible sources','separate facts, uncertainty, and conclusions','present sources and a concise result']
    :intent==='build'?['break the requirement into features','inspect existing source and dependencies','implement the smallest safe step','run tests and report verified evidence']
    :intent==='creative'?['clarify format and style','prepare draft or prompt','create output via an allowed tool','verify format and availability of the output']
    :intent==='action'?['identify exact target and impact','check authorization and risk','request approval for any irreversible change','execute only permitted steps and attach proof']
    :intent==='analysis'?['capture the question and assumptions','process available inputs','check contradictions and uncertainty','answer with a clear conclusion']
    :['understand the question','reply naturally and concisely in Slovak unless the user explicitly writes in or requests another language'];
  return {version:'1.2',intent,risk,repair,requires_approval:ownerMode?false:risk==='high',steps,completion_checks:['Output matches the current goal and requested scope.','Executed actions are backed by verified tool receipts.','Remaining blockers and uncertainties are clearly stated.'],execution_status:'not-started',grants_permissions:false};
}
