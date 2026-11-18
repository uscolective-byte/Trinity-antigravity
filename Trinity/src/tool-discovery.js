import {toJSONSchema} from 'zod';

const operationLabels = {
  portfolio_summary: 'Prehľad simulovaného portfólia',
  commodity_desk: 'Prehľad komoditných dát a simulovaného portfólia',
  commodity_trade: 'Zapísať simulovaný obchod s komoditou',
  commodity_auto_invest: 'Spustiť simulovaný komoditný cyklus',
  terminal_charge: 'Pripraviť podklady na prijatie platby',
  terminal_payout: 'Pripraviť inštrukcie na ručné odoslanie platby',
  finance_propose_transfer: 'Uložiť návrh prevodu',
  finance_confirm_transfer: 'Overiť návrh prevodu a dostupnosť odoslania',
  finance_audit_ledger: 'Prečítať interný audit finančných návrhov',
  domain_sell: 'Zaevidovať predaj domény v Trinity',
  domain_lease: 'Zaevidovať prenájom domény v Trinity',
  domain_env_provision: 'Pripraviť konfiguráciu doménových prostredí v Trinity',
  domain_env_deploy: 'Publikovať HTML na trase prostredia Trinity',
  ecosystem_synthesize: 'Zaregistrovať definíciu rozšírenia v katalógu',
  quantum_parallel: 'Ohodnotiť zadané textové vetvy',
  quantum_fusion: 'Zlúčiť dodané výstupy podľa váh',
  quantum_deliberate: 'Porovnať pohľady a zhrnúť výsledok',
  quantum_accelerate: 'Spracovať zadanie cez kognitívny modul',
  network_dns: 'Vyhľadať DNS záznam cez Cloudflare DoH',
  google_cloud_manage: 'Overiť Google Cloud alebo vypísať modely',
  pc_git_commit: 'Vyžiadať Git commit cez PC bránu',
  fleet_status: 'Skontrolovať dostupnosť služieb flotily'
};

// Discovery describes only the request's already-authorized tool set.
// It never enables plugins or grants execution permissions.
export function describeAvailableTools(activeTools, schemas, help, input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected {query?:string,name?:string}');
  if (Object.keys(input).some(key => !['query', 'name'].includes(key))) throw new Error('Unknown discovery argument');
  for (const key of ['query', 'name']) if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key].length > 200)) throw new Error('Invalid discovery argument');
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const query = normalize(input.query || '').trim();
  const names = [...new Set(activeTools)].filter(name => input.name ? name === input.name : !query || normalize([name, operationLabels[name], help[name]].join(' ')).includes(query));
  if (input.name && !names.length) throw new Error('Tool is not available for this request');
  return {
    scope: 'authorized-request-tools', total: names.length,
    tools: names.slice(0, 12).map(name => ({
      name, description: help[name] || name,
      display_name: operationLabels[name] || name.replaceAll('_', ' '),
      ...(schemas[name] ? {input_schema: toJSONSchema(schemas[name], {unrepresentable: 'any',io:'input'})} : {})
    })),
    truncated: names.length > 12,
    note: 'Use name for an exact argument schema. Listed tools still require their normal authorization, connection and execution checks.'
  };
}

export function discoveryInstructions(activeTools) {
  const workspaceGuide=[
    activeTools.includes('pc_find_files')?'Na nájdenie názvov súborov použi pc_find_files, napríklad {"path":"Trinity/src","glob":"**/*.js","limit":50}.':null,
    activeTools.includes('pc_search_text')?'Na hľadanie definície alebo textu v kóde použi pc_search_text, napríklad {"path":"Trinity/src","pattern":"nazovFunkcie","glob":"**/*.js","regex":false}. Argument textu je pattern; argument priečinka je path.':null,
    activeTools.includes('pc_find_files')?'Priečinok prehliadaj pomocou pc_find_files; čítanie pc_file_read a read_file vyžaduje konkrétny súbor. Názvy nástrojov neodhaduj; pri neistote si najprv vyžiadaj presnú schému cez describe_tools.':null
  ].filter(Boolean).join(' ');
  return `Nástroj describe_tools je interný katalóg: {"tool":"describe_tools","arguments":{"query":"hľadaná schopnosť"}} alebo {"tool":"describe_tools","arguments":{"name":"presný_názov"}}. Ak si nie si istá argumentmi alebo nevidíš vhodný nástroj v stručnom prehľade, najprv použi describe_tools a potom skutočný nástroj. Bezpečné čítacie nástroje používaj automaticky podľa úlohy, používateľ nemusí poznať ich názov. ${workspaceGuide} Katalóg nepridáva oprávnenia ani pripojenie k službe. Pri platbe, nákupe, mazaní a citlivom zápise dodrž existujúce schvaľovanie a rozsah zadania. Finálne uveď vykonané kroky a neoverené alebo čakajúce výsledky podľa dokladov. Všetky povolené názvy pre túto požiadavku: ${[...new Set(activeTools)].join(', ')}.`;
}
