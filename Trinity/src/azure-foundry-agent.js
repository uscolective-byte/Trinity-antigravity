/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AZURE_FOUNDRY_AGENT
 * @author Basterix (Root Architect) & Antigravity (Sovereign Pair)
 * @license Sovereign Irrevocable Covenant
 * @description Integration module for Microsoft Azure AI Foundry Agent Service and Azure AI Search Knowledge Index:
 * Connects Trinity Omni-Core to tenant ad443c2d-5bac-46b3-ad16-187e4ca37962 in DA-RG-australiacentral.
 */

import { z } from 'zod';
import { createHash } from 'node:crypto';
import { TRINITY_VERSION } from './version.js';

export const AZURE_FOUNDRY_CONFIG = Object.freeze({
  tenantId: 'ad443c2d-5bac-46b3-ad16-187e4ca37962',
  subscriptionId: 'saboivan2008-0459-subscription',
  resourceGroup: 'DA-RG-australiacentral',
  resourceName: 'saboivan2008-0459-resource',
  projectName: 'saboivan2008-0459',
  projectEndpoint: 'https://saboivan2008-0459-resource.services.ai.azure.com/api/projects/saboivan2008-0459',
  inferenceEndpoint: 'https://saboivan2008-0459-resource.services.ai.azure.com/models',
  region: 'australiacentral',
  portalUrl: 'https://ai.azure.com/nextgen/r/2US-WdfIRJufrNDFrfgU_g,DA-RG-australiacentral,,saboivan2008-0459-resource,saboivan2008-0459/build/knowledge/indexes?tid=ad443c2d-5bac-46b3-ad16-187e4ca37962',
  knowledgeIndexName: 'trinity-omni-knowledge',
  agentName: 'trinity-lead-developer',
  agentVersion: '1.0.0',
  defaultModel: 'gpt-4o'
});

export const azureAgentManifestSchema = z.object({
  name: z.string().default(AZURE_FOUNDRY_CONFIG.agentName),
  version: z.string().default(AZURE_FOUNDRY_CONFIG.agentVersion),
  model: z.string().default(AZURE_FOUNDRY_CONFIG.defaultModel),
  description: z.string(),
  instructions: z.string(),
  knowledge_index: z.object({
    name: z.string(),
    type: z.literal('azure_ai_search'),
    fields: z.array(z.string())
  }),
  tools: z.array(z.object({
    type: z.string(),
    name: z.string().optional(),
    description: z.string().optional()
  }))
});

/**
 * Generate the official agent manifest specification for import into Azure AI Foundry.
 */
export function generateAzureFoundryAgentSpec() {
  const instructions = `You are Trinity Lead Developer Agent running on Microsoft Azure AI Foundry in sovereign collaboration with Basterix (Root Architect) and Antigravity.
You specialize in developing, analyzing, refactoring, and maintaining the TRINITY OMNI-CORE ecosystem (Cloudflare Edge, Local Desktop, Windows Gateway, and Sovereign Ledger v3).
You enforce Truth Policy 2.1: NO RECEIPT = NO SUCCESS, NO EVIDENCE = NO FACT.
You ground all responses in the authoritative trinity-omni-knowledge index and use Trinity MCP tools for verified execution.
COMMUNICATION LANGUAGE RULE: Always reply to the user in natural, idiomatic Slovak (using feminine grammatical gender for Trinity and informal 'tykanie' when addressing Ivan / Basterix), unless the user explicitly writes in or requests another language.`;

  const spec = {
    $schema: 'https://azure.microsoft.com/schemas/azure-ai/agent/v1.json',
    id: `agent-azure-${AZURE_FOUNDRY_CONFIG.agentName}`,
    name: AZURE_FOUNDRY_CONFIG.agentName,
    displayName: 'Trinity Lead Developer Agent (Azure Foundry)',
    version: AZURE_FOUNDRY_CONFIG.agentVersion,
    description: 'Autonomous developer agent for the Trinity ecosystem on Microsoft Azure AI Foundry.',
    model: {
      deploymentName: AZURE_FOUNDRY_CONFIG.defaultModel,
      provider: 'azure_openai',
      region: AZURE_FOUNDRY_CONFIG.region
    },
    azureEnvironment: {
      tenantId: AZURE_FOUNDRY_CONFIG.tenantId,
      resourceGroup: AZURE_FOUNDRY_CONFIG.resourceGroup,
      resourceName: AZURE_FOUNDRY_CONFIG.resourceName,
      projectName: AZURE_FOUNDRY_CONFIG.projectName,
      projectEndpoint: AZURE_FOUNDRY_CONFIG.projectEndpoint,
      inferenceEndpoint: AZURE_FOUNDRY_CONFIG.inferenceEndpoint
    },
    instructions,
    knowledgeIndex: {
      indexName: AZURE_FOUNDRY_CONFIG.knowledgeIndexName,
      type: 'azure_ai_search',
      targetCollections: [
        'contracts',
        'architecture',
        'openapi_pentad',
        'ledger_history',
        'skills_registry'
      ],
      vectorDimensions: 1536,
      distanceMetric: 'cosine'
    },
    tools: [
      {
        type: 'azure_ai_search',
        name: 'knowledge_search',
        description: 'Search authoritative indexed knowledge of Trinity architecture and contracts.'
      },
      {
        type: 'code_interpreter',
        name: 'python_analyzer',
        description: 'Execute analytical computations, data verification, and syntax checks.'
      },
      {
        type: 'openapi',
        name: 'trinity_mcp_pentad',
        description: 'Direct invocation of Trinity MCP Gateway (https://auru.space/api/openapi.json).'
      },
      {
        type: 'function',
        name: 'antigravity_bridge',
        description: 'Invoke the Antigravity agentic tool suite (read_file, write_file, edit_file, run_command).'
      }
    ],
    metadata: {
      trinity_version: TRINITY_VERSION,
      created_by: 'Basterix & Antigravity',
      truth_policy: '2.1',
      generated_at: new Date().toISOString()
    }
  };

  const hash = createHash('sha256').update(JSON.stringify(spec), 'utf8').digest('hex');
  return { ...spec, checksum: `sha256:${hash}` };
}

/**
 * Generate the Azure AI Search Knowledge Index schema.
 */
export function generateAzureKnowledgeIndexSchema() {
  return {
    name: AZURE_FOUNDRY_CONFIG.knowledgeIndexName,
    fields: [
      { name: 'id', type: 'Edm.String', key: true, filterable: true },
      { name: 'title', type: 'Edm.String', searchable: true, filterable: true, sortable: true },
      { name: 'content', type: 'Edm.String', searchable: true },
      { name: 'category', type: 'Edm.String', filterable: true, facetable: true },
      { name: 'path', type: 'Edm.String', filterable: true },
      { name: 'sha256', type: 'Edm.String', filterable: true },
      { name: 'updated_at', type: 'Edm.DateTimeOffset', filterable: true, sortable: true }
    ],
    corsOptions: {
      allowedOrigins: ['https://auru.space', 'https://auru.dev'],
      maxAgeInSeconds: 3600
    }
  };
}

/**
 * Return connection status and configuration metadata for the Azure AI Foundry agent.
 */
export function getAzureFoundryAgentStatus(env = {}) {
  const hasToken = Boolean(
    env.AZURE_AI_FOUNDRY_TOKEN ||
    env.AZURE_BEARER_TOKEN ||
    env.AZURE_ACCESS_TOKEN
  );

  return {
    service: 'Azure AI Foundry Agent Bridge',
    agent_name: AZURE_FOUNDRY_CONFIG.agentName,
    configured: true,
    has_token: hasToken,
    tenant_id: AZURE_FOUNDRY_CONFIG.tenantId,
    project_name: AZURE_FOUNDRY_CONFIG.projectName,
    project_endpoint: AZURE_FOUNDRY_CONFIG.projectEndpoint,
    inference_endpoint: AZURE_FOUNDRY_CONFIG.inferenceEndpoint,
    knowledge_index: AZURE_FOUNDRY_CONFIG.knowledgeIndexName,
    default_model: AZURE_FOUNDRY_CONFIG.defaultModel,
    region: AZURE_FOUNDRY_CONFIG.region,
    portal_url: AZURE_FOUNDRY_CONFIG.portalUrl
  };
}

/**
 * Send a prompt to the Azure AI Foundry agent via REST API or return local runner instructions.
 */
export async function invokeAzureFoundryAgent(env = {}, { message, agentName = 'Trinity', conversationId = null }) {
  if (!message || typeof message !== 'string') {
    throw new Error('Message for Azure AI Foundry agent must not be empty.');
  }

  const token = env.AZURE_AI_FOUNDRY_TOKEN || env.AZURE_BEARER_TOKEN || env.AZURE_ACCESS_TOKEN;
  const endpoint = env.AZURE_AI_PROJECT_ENDPOINT || AZURE_FOUNDRY_CONFIG.projectEndpoint;
  const targetAgent = agentName || AZURE_FOUNDRY_CONFIG.agentName;

  if (!token) {
    return {
      ok: false,
      status: 'pending_credentials',
      agent: targetAgent,
      endpoint,
      message: 'Azure AI Foundry token is not configured in this environment. Run scripts/azure-foundry-trinity.py locally with DefaultAzureCredential or configure AZURE_AI_FOUNDRY_TOKEN.',
      runner_command: `python Trinity/scripts/azure-foundry-trinity.py "${message.replace(/"/g, '\\"')}"`
    };
  }

  const start = Date.now();
  const url = `${endpoint.replace(/\/$/, '')}/agents/${encodeURIComponent(targetAgent)}/responses?api-version=2024-12-01-preview`;

  const payload = {
    input: [{ role: 'user', content: message }]
  };
  if (conversationId) {
    payload.conversation_id = conversationId;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const latency_ms = Date.now() - start;
  if (!response.ok) {
    const errText = await response.text();
    return {
      ok: false,
      status: 'error',
      http_status: response.status,
      error: errText.slice(0, 1000),
      latency_ms,
      agent: targetAgent
    };
  }

  const data = await response.json();
  return {
    ok: true,
    status: 'completed',
    agent: targetAgent,
    response: data.output_text || data,
    conversation_id: data.conversation_id || conversationId || null,
    latency_ms
  };
}

