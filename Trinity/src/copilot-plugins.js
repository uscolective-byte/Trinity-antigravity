/**
 * Trinity Copilot Plugin Ecosystem
 * Poskytuje správu pluginov pre Trinity Copilot:
 * - Registrácia pluginov s metadátami, závislosťami a zoznamom skillov
 * - Vstavané pluginy (Core, PowerPlatform, WebResearch, Media, Analytics, PCBridge, Dialog)
 * - Podpora pre dynamické zapínanie / vypínanie pluginov
 */

import {skills} from './skillRegistry.js';

export const BUILTIN_COPILOT_PLUGINS = [
  {
    id: 'core-copilot',
    name: 'Core Copilot Pack',
    version: '1.0.0',
    description: 'Základné robustné mechanizmy: validácia, timeout, circuit-breaker, retry a audit.',
    skills: ['validateInput', 'withTimeout', 'checkHttpStatus', 'checkResponseStructure', 'logAudit', 'withRetry', 'circuitBreaker', 'rateLimiter', 'cacheGet', 'cachePut', 'recordMetrics'],
    category: 'core',
    enabled: true,
    required: true
  },
  {
    id: 'powerplatform-connector',
    name: 'Power Platform & Copilot Studio Connector',
    version: '1.0.0',
    description: 'Integrácia s Microsoft Power Platform a Copilot Studio bot endpointmi.',
    skills: ['callPowerPlatform'],
    category: 'integration',
    enabled: true,
    required: false
  },
  {
    id: 'web-researcher',
    name: 'Web Research Plugin',
    version: '1.0.0',
    description: 'Webové vyhľadávanie a extrakcia relevantných úryvkov zo zdrojov.',
    skills: ['webSearch'],
    category: 'integration',
    enabled: true,
    required: false
  },
  {
    id: 'media-studio',
    name: 'Media & Image Generation Plugin',
    version: '1.0.0',
    description: 'Tvorba obrázkov cez Workers AI a ukladanie médií do R2.',
    skills: ['generateImage', 'r2Store', 'r2Get'],
    category: 'media',
    enabled: true,
    required: false
  },
  {
    id: 'data-analytics',
    name: 'Data & Text Analytics Plugin',
    version: '1.0.0',
    description: 'Analýza textu, detekcia sentimentu, presné výpočty a štatistika.',
    skills: ['analyzeText', 'calculate', 'statistics'],
    category: 'analytics',
    enabled: true,
    required: false
  },
  {
    id: 'pc-bridge-automation',
    name: 'PC Bridge & Git Automation Plugin',
    version: '1.0.0',
    description: 'Spúšťanie lokálnych overených skriptov s SHA-256 a Git operácie.',
    skills: ['pcRunScript', 'pcGitCommit', 'pcGitPr'],
    category: 'automation',
    enabled: true,
    required: false
  },
  {
    id: 'dialog-experience',
    name: 'Dialog & User Experience Plugin',
    version: '1.0.0',
    description: 'Správa histórie relácií, viacjazyčnosť, fallback, bohaté formátovanie a sanitizácia.',
    skills: ['dialogManagement', 'detectLanguage', 'multilingualSupport', 'fallbackHandler', 'formatRichResponse', 'rateLimitedFeedback', 'securitySanitise'],
    category: 'user',
    enabled: true,
    required: true
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
      throw new Error('Plugin musí obsahovať aspoň id a name.');
    }
    const existing = this._plugins.get(plugin.id);
    if (existing?.required) {
      throw new Error(`Povinný systémový plugin '${plugin.id}' nie je možné prepísať.`);
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
    if (!plugin) throw new Error(`Plugin '${id}' neexistuje.`);
    plugin.enabled = true;
    return plugin;
  }

  disable(id) {
    const plugin = this._plugins.get(id);
    if (!plugin) throw new Error(`Plugin '${id}' neexistuje.`);
    if (plugin.required) {
      throw new Error(`Povinný plugin '${id}' nie je možné vypnúť.`);
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
