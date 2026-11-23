/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Trinity Copilot plugin ecosystem registry and skill enablement governance for TRINITY OMNI-CORE.
 */
/**
 * Trinity Copilot Plugin Ecosystem
 * Provides plugin management for Trinity Copilot:
 * - Plugin registration with metadata, dependencies, and skill lists
 * - Built-in plugins (Core, PowerPlatform, WebResearch, Media, Analytics, PCBridge, Dialog, etc.)
 * - Dynamic enabling and disabling of optional plugins
 */

export const BUILTIN_COPILOT_PLUGINS = [
  {
    id:'integration-diagnostics',name:'Integration Configuration Diagnostics',version:'1.0.0',
    description:'Inspect configuration of AI, Copilot Studio, and PC Bridge without disclosing secrets; live connectivity requires a separate check.',
    skills:['integrationReadiness'],category:'integration',enabled:true,required:false
  },
  {
    id: 'core-copilot',
    name: 'Core Copilot Pack',
    version: '1.0.0',
    description: 'Core resilience mechanisms: validation, timeout, circuit breaker, retry, and auditing.',
    skills: ['validateInput', 'withTimeout', 'checkHttpStatus', 'checkResponseStructure', 'logAudit', 'withRetry', 'circuitBreaker', 'rateLimiter', 'cacheGet', 'cachePut', 'recordMetrics'],
    category: 'core',
    enabled: true,
    required: true
  },
  {
    id: 'powerplatform-connector',
    name: 'Power Platform & Dynamics 365 Dataverse Connector',
    version: '2.0.0',
    description: 'Integration with Microsoft Power Platform, Dynamics 365 Dataverse (CRM), and Copilot Studio.',
    skills: ['callPowerPlatform', 'dataverseWhoAmI', 'dataverseQuery', 'dataverseCreateRecord', 'dataverseUpdateRecord', 'dataverseDeleteRecord'],
    category: 'integration',
    enabled: true,
    required: false
  },
  {
    id: 'web-researcher',
    name: 'Web Research Plugin',
    version: '1.0.0',
    description: 'Web search and extraction of relevant source excerpts.',
    skills: ['webSearch'],
    category: 'integration',
    enabled: true,
    required: false
  },
  {
    id: 'media-studio',
    name: 'Media & Image Generation Plugin',
    version: '1.0.0',
    description: 'Image generation via Workers AI and media storage in R2.',
    skills: ['generateImage', 'r2Store', 'r2Get'],
    category: 'media',
    enabled: true,
    required: false
  },
  {
    id: 'data-analytics',
    name: 'Data & Text Analytics Plugin',
    version: '1.0.0',
    description: 'Text analysis, sentiment detection, precise calculations, and descriptive statistics.',
    skills: ['analyzeText', 'calculate', 'statistics'],
    category: 'analytics',
    enabled: true,
    required: false
  },
  {
    id: 'pc-bridge-automation',
    name: 'PC Bridge & Git Automation Plugin',
    version: '1.0.0',
    description: 'Execution of verified local scripts with SHA-256 receipts and Git operations.',
    skills: ['pcRunScript', 'pcGitCommit', 'pcGitPr'],
    category: 'automation',
    enabled: true,
    required: false
  },
  {
    id: 'dialog-experience',
    name: 'Dialog & User Experience Plugin',
    version: '1.0.0',
    description: 'Session history management, multilingual support, fallbacks, rich formatting, and sanitization.',
    skills: ['dialogManagement', 'detectLanguage', 'multilingualSupport', 'fallbackHandler', 'formatRichResponse', 'rateLimitedFeedback', 'securitySanitise'],
    category: 'user',
    enabled: true,
    required: true
  },
  {
    id: 'security-devops',
    name: 'Security & DevOps Toolkit',
    version: '1.1.0',
    description: 'Code auditing, refactoring, SQL query inspection, cryptographic hashes, semver, and JWT decoding.',
    skills: ['codeRefactor', 'sqlValidate', 'cryptoHash', 'diffCompare', 'semverCheck', 'jwtDecode'],
    category: 'security',
    enabled: true,
    required: false
  },
  {
    id: 'data-intelligence',
    name: 'Data Intelligence & Processing',
    version: '1.1.0',
    description: 'JSON path transformation, RFC CSV parsing, statistics, and Base64 encoding/decoding.',
    skills: ['jsonTransform', 'csvParse', 'statistics', 'analyzeText', 'base64Codec'],
    category: 'analytics',
    enabled: true,
    required: false
  },
  {
    id: 'web-standards',
    name: 'Web Standards & Network Defense',
    version: '1.1.0',
    description: 'HTML sanitization, Markdown compiler, URL parsing, and IP address validation.',
    skills: ['htmlSanitize', 'markdownToHtml', 'urlParse', 'ipCheck', 'colorPalette'],
    category: 'web',
    enabled: true,
    required: false
  },
  {
    id: 'cloud-worker-ops',
    name: 'Cloudflare Worker Operations & Telemetry',
    version: '1.1.0',
    description: 'Worker telemetry, latency and error-rate evaluation, and overload protection.',
    skills: ['cloudMetricEvaluate', 'checkHttpStatus', 'circuitBreaker', 'rateLimiter', 'recordMetrics'],
    category: 'cloud',
    enabled: true,
    required: false
  },
  {
    id: 'gemini-developer-pack',
    name: 'Gemini Developer Agent & Automation Suite',
    version: '1.0.0',
    description: 'Trinity development and operations via Gemini: diagnostics, verified commands, file inspection, and deployment.',
    skills: ['geminiDevStatus', 'geminiDevRunCommand', 'geminiDevFileInspect', 'geminiDevDeploy'],
    category: 'automation',
    enabled: true,
    required: false
  },
  {
    id: 'ai-studio-builder',
    name: 'AI Studio Builder Plugin',
    version: '1.0.0',
    description: 'Copilot agent builds, revises, and lists web apps in Trinity AI Studio.',
    skills: ['aiStudioBuild', 'aiStudioRevise', 'aiStudioList'],
    category: 'automation',
    enabled: true,
    required: false
  },
  {
    id: 'copilot-studio-agent',
    name: 'Microsoft Copilot Studio Agent (Direct Line)',
    version: '1.0.0',
    description: 'Trinity queries a Microsoft Copilot Studio agent over the Direct Line web channel.',
    skills: ['copilotStudioAsk'],
    category: 'integration',
    enabled: true,
    required: false
  },
  {
    id: 'productivity-plus',
    name: 'Productivity Plus',
    version: '1.0.0',
    description: 'Practical utilities: slugify, reading time, extractive summary, date diff, and cron scheduling.',
    skills: ['slugify', 'readingTime', 'extractiveSummary', 'dateDiff', 'cronNextRuns'],
    category: 'analytics',
    enabled: true,
    required: false
  },
  {
    id: 'developer-toolbox',
    name: 'Developer Engineering & Syntax Toolbox',
    version: '1.0.0',
    description: 'Developer utilities: regular expression testing/debugging, JSON Schema validation, and code snippet metrics.',
    skills: ['regexTester', 'jsonSchemaValidate', 'codeSnippetAnalyze'],
    category: 'engineering',
    enabled: true,
    required: false
  },
  {
    id: 'entertainment-arcade',
    name: 'Interactive Entertainment & Gaming Arcade',
    version: '1.0.0',
    description: 'Interactive gaming pack: text RPG quest and dungeon master, trivia quiz engine, and logic riddle generator.',
    skills: ['rpgQuestMaster', 'triviaQuizEngine', 'riddleGenerator'],
    category: 'entertainment',
    enabled: true,
    required: false
  },
  {
    id: 'education-academy',
    name: 'Education, Language & Science Academy',
    version: '1.0.0',
    description: 'Learning module: interactive language tutor, step-by-step math explanations, and Leitner flashcard deck.',
    skills: ['languageTutor', 'mathConceptExplainer', 'flashcardStudyDeck'],
    category: 'education',
    enabled: true,
    required: false
  },
  {
    id: 'lifestyle-wellness',
    name: 'Lifestyle, Habits & Wellness Coach',
    version: '1.0.0',
    description: 'Personal growth and wellness: habit and streak tracking, BMR/TDEE macro calculation, and guided breathing.',
    skills: ['habitForge', 'nutritionMacroCalc', 'breathFocusCoach'],
    category: 'lifestyle',
    enabled: true,
    required: false
  },
  {
    id: 'creative-studio-plus',
    name: 'Creative Studio & Screenplay Workshop',
    version: '1.0.0',
    description: 'Creative toolkit: rhyme and poetic structure generator and standard screenplay formatter.',
    skills: ['rhymePoemCraft', 'screenplayFormatter'],
    category: 'creative',
    enabled: true,
    required: false
  },
  {
    id: 'science-explorer',
    name: 'Science & Fundamental Physics Explorer',
    version: '1.0.0',
    description: 'Scientific module: periodic table of chemical elements and exact universal physical constants.',
    skills: ['periodicTableLookup', 'physicsConstants'],
    category: 'science',
    enabled: true,
    required: false
  },
  {
    id: 'azure-foundry-agent',
    name: 'Azure AI Foundry Agent & Knowledge Bridge',
    version: '1.0.0',
    description: 'Connects Trinity to Microsoft Azure AI Foundry Agent Service (DA-RG-australiacentral) and the Knowledge Index.',
    skills: ['azureFoundryAgentSync', 'azureKnowledgeSearch', 'azureIndexAudit'],
    category: 'integration',
    enabled: true,
    required: false
  },
  {
    id: 'antigravity-suite',
    name: 'Google Antigravity Agentic Tool Suite',
    version: '1.0.0',
    description: 'Full Antigravity agentic tool suite (read_file, write_file, edit_file, run_command, manage_task, search_marketplace).',
    skills: ['antigravityReadFile', 'antigravityWriteFile', 'antigravityEditFile', 'antigravityRunCommand', 'antigravityManageTask', 'antigravitySearchMarketplace'],
    category: 'engineering',
    enabled: true,
    required: false
  }
];

class CopilotPluginRegistry {
  constructor() {
    this._plugins = new Map();
    for (const plugin of BUILTIN_COPILOT_PLUGINS) {
      this._plugins.set(plugin.id, { ...plugin });
    }
  }

  register(plugin) {
    if (!plugin?.id || !plugin?.name) {
      throw new Error('Plugin must include at least id and name.');
    }
    const existing = this._plugins.get(plugin.id);
    if (existing?.required) {
      throw new Error(`Required system plugin '${plugin.id}' cannot be overwritten.`);
    }
    this._plugins.set(plugin.id, {
      ...plugin,
      version: plugin.version || '1.0.0',
      enabled: plugin.enabled ?? true,
      registeredAt: new Date().toISOString()
    });
    return this._plugins.get(plugin.id);
  }

  get(id) {
    return this._plugins.get(id) || null;
  }

  list() {
    return Array.from(this._plugins.values());
  }

  enable(id) {
    const plugin = this._plugins.get(id);
    if (!plugin) throw new Error(`Plugin '${id}' does not exist.`);
    plugin.enabled = true;
    return plugin;
  }

  disable(id) {
    const plugin = this._plugins.get(id);
    if (!plugin) throw new Error(`Plugin '${id}' does not exist.`);
    if (plugin.required) {
      throw new Error(`Required plugin '${id}' cannot be disabled.`);
    }
    plugin.enabled = false;
    return plugin;
  }

  isSkillEnabled(skillName) {
    for (const plugin of this._plugins.values()) {
      if (plugin.enabled && Array.isArray(plugin.skills) && plugin.skills.includes(skillName)) {
        return true;
      }
    }
    return false;
  }
}

export const copilotPluginRegistry = new CopilotPluginRegistry();
export const copilotPlugins = BUILTIN_COPILOT_PLUGINS;

export function assertCopilotSkillEnabled(name) {
  const owners=copilotPluginRegistry.list().filter(plugin=>plugin.skills?.includes(name));
  if(owners.length&&!owners.some(plugin=>plugin.enabled))throw new Error(`Plugin for skill '${name}' is disabled.`);
}
