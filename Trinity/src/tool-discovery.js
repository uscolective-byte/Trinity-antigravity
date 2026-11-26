import {toJSONSchema} from 'zod';

const operationLabels = {
  portfolio_summary: 'Simulated portfolio overview',
  commodity_desk: 'Commodity market data and simulated portfolio overview',
  commodity_trade: 'Record simulated commodity trade',
  commodity_auto_invest: 'Run simulated commodity investment cycle',
  terminal_charge: 'Prepare payment intake details',
  terminal_payout: 'Prepare manual payment payout instructions',
  finance_propose_transfer: 'Save transfer proposal',
  finance_confirm_transfer: 'Verify transfer proposal and payout availability',
  finance_audit_ledger: 'Read internal financial proposal audit ledger',
  domain_sell: 'Record domain sale in Trinity',
  domain_lease: 'Record domain lease in Trinity',
  domain_env_provision: 'Prepare domain environment configuration in Trinity',
  domain_env_deploy: 'Publish HTML to a Trinity environment route',
  ecosystem_synthesize: 'Register extension definition in catalog',
  quantum_parallel: 'Evaluate provided text branches',
  quantum_fusion: 'Fuse supplied outputs by weights',
  quantum_deliberate: 'Compare perspectives and synthesize result',
  quantum_accelerate: 'Process prompt through cognitive module',
  network_dns: 'Query DNS record via Cloudflare DoH',
  google_cloud_manage: 'Verify Google Cloud or list models',
  pc_git_commit: 'Request Git commit via PC gateway',
  fleet_status: 'Check fleet service availability'
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
    activeTools.includes('pc_find_files')?'To find file names, use pc_find_files, for example {"path":"Trinity/src","glob":"**/*.js","limit":50}.':null,
    activeTools.includes('pc_search_text')?'To search for a definition or text in code, use pc_search_text, for example {"path":"Trinity/src","pattern":"functionName","glob":"**/*","regex":false}. The text argument is pattern; the directory argument is path. Unless an extension is explicitly requested, use glob **/*; do not guess file extensions. If a filter selects no files, broaden it and continue automatically within the specified directory.':null,
    activeTools.includes('pc_find_files')?'Browse directories using pc_find_files; pc_file_read and read_file require a specific file path. Do not guess tool names; when unsure, request the exact schema via describe_tools first.':null
  ].filter(Boolean).join(' ');
  return `The describe_tools tool is an internal catalog: {"tool":"describe_tools","arguments":{"query":"desired capability"}} or {"tool":"describe_tools","arguments":{"name":"exact_name"}}. If you are unsure about arguments or do not see a suitable tool in the short overview, call describe_tools first and then invoke the actual tool. Use safe read-only tools automatically as needed for the task; the user does not need to know their names. ${workspaceGuide} The catalog does not grant permissions or service connectivity. For payments, purchases, deletions, and sensitive writes, respect existing approval requirements and request scope. Finally, report completed steps and unverified or pending outcomes strictly according to receipts. All authorized tool names for this request: ${[...new Set(activeTools)].join(', ')}.`;
}

function stripSchemaMeta(node) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(stripSchemaMeta);
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === '$schema' || k === 'additionalProperties') continue;
    out[k] = stripSchemaMeta(v);
  }
  return out;
}

export function buildNativeToolDefinitions(toolNames, schemas, help, maxTools = 24) {
  const unique = [...new Set(toolNames || [])].slice(0, maxTools);
  const defs = [];
  for (const name of unique) {
    let parameters = { type: 'object', properties: {} };
    if (schemas?.[name]) {
      try {
        const raw = toJSONSchema(schemas[name], { unrepresentable: 'any', io: 'input' });
        const cleaned = stripSchemaMeta(raw);
        if (cleaned && typeof cleaned === 'object' && cleaned.type === 'object') {
          parameters = cleaned;
        }
      } catch {}
    }
    defs.push({
      type: 'function',
      function: {
        name,
        description: String(help?.[name] || name).slice(0, 320),
        parameters
      }
    });
  }
  return defs;
}

export function formatToolCatalogWithArgs(toolNames, schemas, help) {
  return [...new Set(toolNames || [])].map((name) => {
    let sig = '';
    if (schemas?.[name]) {
      try {
        const js = toJSONSchema(schemas[name], { unrepresentable: 'any', io: 'input' });
        const props = js?.properties && typeof js.properties === 'object' ? Object.keys(js.properties) : [];
        const req = new Set(Array.isArray(js?.required) ? js.required : []);
        if (props.length) {
          sig = `(${props.slice(0, 6).map((p) => (req.has(p) ? `${p}*` : p)).join(', ')}${props.length > 6 ? ', …' : ''})`;
        } else {
          sig = '()';
        }
      } catch {}
    }
    return `${name}: ${String(help?.[name] || name)}${sig ? ` [args: ${sig.slice(1, -1)}]` : ''}`;
  }).join('; ');
}

