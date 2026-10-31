// Publicly safe, metadata-only control plane for Trinity's external AI clients.
// The inventory is NOT a record of OAuth logins or successful client calls.
// A remote MCP server and a provider API key are separate capabilities.

const configuredString=(env,name)=>typeof env?.[name]==='string'&&env[name].trim().length>0;
const hasSecretBinding=(env,name)=>typeof env?.[name]?.get==='function';

export const AGENT_CONNECTION_IDS=Object.freeze([
  'cloudflare','trinity','pc-local','codex','chatgpt',
  'antigravity','gemini','copilot'
]);

export function agentConnectionMatrix(env={},pcBridge=null){
  const ai=typeof env.AI?.run==='function';
  const d1=typeof env.DB?.prepare==='function';
  const isPC=pcBridge?.connected===true;
  const mcpEnabled=typeof env.TRINITY_MCP_DISABLED==='string'
    ?env.TRINITY_MCP_DISABLED!=='true':true; // Plugin gate checked at runtime.
  const bridgeEnabled=env.TRINITY_ASSISTANT_BRIDGE_ENABLED==='true';
  const item=(id,kind,transport,serverConfigured,extra={})=>({
    id,kind,transport,server_configured:!!serverConfigured,
    client_authenticated:false,client_verified:false,
    execution_verified:false,...extra
  });
  const clients=[
    item('cloudflare','platform','workers-service-bindings',ai&&d1,{
      workers_ai_bound:ai,d1_bound:d1,
      secrets_store_gemini:hasSecretBinding(env,'TRINITY_MASTER_GOOGLE'),
      secrets_store_copilot:hasSecretBinding(env,'TRINITY_MASTER_COPILOT'),
      actual_cloudflare_account_access_verified:false
    }),
    item('trinity','orchestrator','streamable-http',mcpEnabled&&d1,{
      remote_endpoint:'/mcp',authorization:'scoped-mcp-key-or-server-session',
      note:'Server config only; plugin and remote endpoint require live validation.'
    }),
    item('pc-local','execution-bridge','heartbeat-and-action-receipts',
      !!env.PC_BRIDGE_V2||configuredString(env,'TRINITY_GATEWAY_KEY'),{
      heartbeat_connected:isPC,
      client_authenticated:false, // A reported heartbeat is not a fresh auth or action receipt.
      last_action_verified:false,
      note:'PC bridge heartbeat is not evidence that a file or shell action ran.'
    }),
    item('codex','mcp-client','stdio-or-remote-mcp',mcpEnabled,{
      remote_endpoint:'/mcp',manual_client_auth_required:true
    }),
    item('chatgpt','mcp-client-or-actions','remote-mcp-or-scoped-rest',mcpEnabled||bridgeEnabled,{
      remote_endpoint:'/mcp',notes_bridge_enabled:bridgeEnabled,
      notes_endpoint:'/api/assistant-bridge/notes',
      manual_client_auth_required:true
    }),
    item('antigravity','local-ide-client','stdio-mcp',mcpEnabled,{
      remote_endpoint:'/mcp',requires_running_pc:true,pc_heartbeat_connected:isPC,
      manual_client_auth_required:true
    }),
    item('gemini','model-provider-and-mcp-client','gemini-api-and-mcp',
      hasSecretBinding(env,'TRINITY_MASTER_GOOGLE')||configuredString(env,'GEMINI_API_KEY'),{
      gemini_credential_configured:
        hasSecretBinding(env,'TRINITY_MASTER_GOOGLE')||configuredString(env,'GEMINI_API_KEY'),
      provider_request_verified:false,manual_client_auth_required:true
    }),
    item('copilot','studio-agent-or-mcp-client','mcp-or-scoped-rest',
      hasSecretBinding(env,'TRINITY_MASTER_COPILOT')||
      configuredString(env,'COPILOT_API_TOKEN')||bridgeEnabled,{
      notes_bridge_enabled:bridgeEnabled,
      notes_endpoint:'/api/assistant-bridge/notes',
      studio_oauth_verified:false,manual_client_auth_required:true
    })
  ];
  return {
    controller:'TRINITY_MASTER',schema_version:1,
    status:'configuration_and_heartbeat_only',
    environment:env.TRINITY_ENV||'unknown',
    remote_mcp_endpoint:'/mcp',
    supports_scoped_read_access:true,
    supports_scoped_write_access:true,
    actual_cross_account_sync_verified:false,
    tokens_or_secrets_read:false,
    provider_calls_executed:false,
    note:'Server config is not a connection. External accounts need separate owner-authorized OAuth or per-client scoped tokens.',
    clients
  };
}
