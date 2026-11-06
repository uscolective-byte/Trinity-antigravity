/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AZURE_FOUNDRY_AGENT
 * @author Basterix (Root Architect) & Antigravity (Sovereign Pair)
 * @license Sovereign Irrevocable Covenant
 * @description Modul pre integráciu Microsoft Azure AI Foundry Agent Service a Azure AI Search Knowledge Indexu:
 * Prepojuje Trinity Omni-Core s tenantom ad443c2d-5bac-46b3-ad16-187e4ca37962 v DA-RG-australiacentral.
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
 * Vygeneruje oficiálnu špecifikáciu agenta pre import do Azure AI Foundry.
 */
export function generateAzureFoundryAgentSpec() {
  const instructions = `You are Trinity Lead Developer Agent running on Microsoft Azure AI Foundry in sovereign collaboration with Basterix (Root Architect) and Antigravity.
You specialize in developing, analyzing, refactoring, and maintaining the TRINITY OMNI-CORE ecosystem (Cloudflare Edge, Local Desktop, Windows Gateway, and Sovereign Ledger v3).
You enforce Truth Policy 2.1: NO RECEIPT = NO SUCCESS, NO EVIDENCE = NO FACT.
You ground all responses in the authoritative trinity-omni-knowledge index and use Trinity MCP tools for verified execution.
You communicate clearly, concisely, and support Slovak and English.`;

  const spec = {
    $schema: 'https://azure.microsoft.com/schemas/azure-ai/agent/v1.json',
    id: `agent-azure-${AZURE_FOUNDRY_CONFIG.agentName}`,
    name: AZURE_FOUNDRY_CONFIG.agentName,
    displayName: 'Trinity Lead Developer Agent (Azure Foundry)',
    version: AZURE_FOUNDRY_CONFIG.agentVersion,
    description: 'Autonómny vývojársky agent pre ekosystém Trinity na Microsoft Azure AI Foundry.',
    model: {
      deploymentName: AZURE_FOUNDRY_CONFIG.defaultModel,
      provider: 'azure_openai',
      region: AZURE_FOUNDRY_CONFIG.region
    },
    azureEnvironment: {
      tenantId: AZURE_FOUNDRY_CONFIG.tenantId,
      resourceGroup: AZURE_FOUNDRY_CONFIG.resourceGroup,
      resourceName: AZURE_FOUNDRY_CONFIG.resourceName,
      projectName: AZURE_FOUNDRY_CONFIG.projectName
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
        description: 'Prehľadá autoritatívne indexované znalosti architektúry a zmlúv Trinity.'
      },
      {
        type: 'code_interpreter',
        name: 'python_analyzer',
        description: 'Vykonáva analytické výpočty, overovanie dát a syntaktickú kontrolu.'
      },
      {
        type: 'openapi',
        name: 'trinity_mcp_pentad',
        description: 'Priame volanie Trinity MCP Gateway (https://auru.space/api/openapi.json).'
      },
      {
        type: 'function',
        name: 'antigravity_bridge',
        description: 'Volanie Antigravity agentic tool suite (read_file, write_file, edit_file, run_command).'
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
 * Vygeneruje schému indexu pre Azure AI Search (Knowledge Index).
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
