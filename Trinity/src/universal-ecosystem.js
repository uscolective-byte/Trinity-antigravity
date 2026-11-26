/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module universal-ecosystem.js (Trinity/src/universal-ecosystem.js) in the TRINITY OMNI-CORE ecosystem.
 */
/**
 * Trinity Universal Ecosystem Engine
 * Provides an infinite (on-demand synthesized) ecosystem for:
 * 1️⃣ Applications (Web Studio, REST APIs, interactive tools, and dashboards)
 * 2️⃣ Plugins (Modular capability bundles with isolated execution and dependencies)
 * 3️⃣ Skills (Executable operational procedures with validation, timeouts, and auditing)
 */

import {skillRegistry, skills} from './skillRegistry.js';
import {copilotPluginRegistry} from './copilot-plugins.js';
import {EXTENDED_SKILLS, EXTENDED_PLUGINS} from './extended-catalog.js';
import {FREE_MODULES_CATALOG, fetchWeather, fetchWikipedia, resolveDns, fetchCryptoMarkets, fetchTechNews, fetchWorldBankIndicator} from './free-modules.js';

export const UNIVERSAL_DOMAINS = [
  {id: 'software-dev', name: 'Software Development', icon: '</>', description: 'Full-stack development, APIs, refactoring, databases, and CI/CD pipelines.'},
  {id: 'cloud-devops', name: 'Cloud & DevOps', icon: '☁', description: 'Cloudflare Workers, D1, R2, KV, Kubernetes, Terraform, and monitoring.'},
  {id: 'cybersecurity', name: 'Cybersecurity', icon: '🛡', description: 'Vulnerability audits, threat modeling, encryption, sanitization, and zero-trust.'},
  {id: 'ai-agents', name: 'Autonomous AI Agents', icon: '🤖', description: 'Multi-agent coordination, tools, task planning, and memory context.'},
  {id: 'data-science', name: 'Data Science & ML', icon: '📊', description: 'Statistics, visualization, data cleaning, predictive models, and ETL pipelines.'},
  {id: 'fintech', name: 'Financial Engineering', icon: '💳', description: 'Budgeting, cashflow, paper portfolios, risk modeling, and cost analysis.'},
  {id: 'ecommerce', name: 'E-commerce & Commerce', icon: '🛍', description: 'Product catalogs, conversions, customer service, and order flows.'},
  {id: 'biotech-health', name: 'Bioinformatics & Health', icon: '🧬', description: 'Biomedical research, sequence and structure analysis, and clinical studies.'},
  {id: 'iot-automation', name: 'Smart Home & IoT', icon: '⚡', description: 'Device automation, sensors, telemetry, and PC Bridge operations.'},
  {id: 'media-design', name: 'Media & UI/UX Design', icon: '🎨', description: 'Graphic design, responsive layouts, typography, and WCAG accessibility.'},
  {id: 'legal-compliance', name: 'Legal & Compliance', icon: '⚖', description: 'GDPR, personal data protection, license agreements, and regulatory audits.'},
  {id: 'education-edtech', name: 'Education & EdTech', icon: '🎓', description: 'Interactive courses, test creation, study summarization, and tutoring.'},
  {id: 'marketing-seo', name: 'Marketing & SEO', icon: '📈', description: 'SEO audits, copywriting, keyword analysis, and content strategies.'},
  {id: 'nlp-translation', name: 'Language Processing & Translation', icon: '🌐', description: 'Multilingual localization, summarization, and key entity extraction.'},
  {id: 'system-architecture', name: 'System Architecture', icon: '🏛', description: 'Distributed systems, microservices, event-driven flows, and resilience.'},
  {id: 'entertainment-gaming', name: 'Games & Interactive Entertainment', icon: '🎮', description: 'Text RPG adventures, quizzes, game mechanics, interactive stories, and riddles.'},
  {id: 'lifestyle-wellness', name: 'Lifestyle & Personal Growth', icon: '🌱', description: 'Habit tracking, time management, nutrition planning, and daily routines.'},
  {id: 'creative-arts', name: 'Arts, Music & Creativity', icon: '🎭', description: 'Creative writing, lyrics, screenwriting, music theory, and audio concepts.'},
  {id: 'science-discovery', name: 'Natural Sciences & Research', icon: '🔬', description: 'Periodic table, physical constants, biochemical models, and scientific calculations.'}
];

export const APPLICATION_TEMPLATES = [
  {templateId: 'dashboard', name: 'Real-time Analytics Dashboard', type: 'web-app', domain: 'data-science'},
  {templateId: 'crm', name: 'Customer & Task Management Hub', type: 'web-app', domain: 'ecommerce'},
  {templateId: 'code-sandbox', name: 'Interactive Code Playground', type: 'web-app', domain: 'software-dev'},
  {templateId: 'api-gateway', name: 'Dynamic REST/JSON Gateway', type: 'api', domain: 'cloud-devops'},
  {templateId: 'security-scanner', name: 'Web Security & Header Auditor', type: 'tool', domain: 'cybersecurity'},
  {templateId: 'agent-studio', name: 'Multi-Agent Workflow Builder', type: 'web-app', domain: 'ai-agents'},
  {templateId: 'media-gallery', name: 'AI Image & Asset Studio', type: 'web-app', domain: 'media-design'},
  {templateId: 'finance-tracker', name: 'Real Portfolio & Cashflow Tracker', type: 'web-app', domain: 'fintech'},
  {templateId: 'knowledge-base', name: 'Self-hosted Verified Knowledge Base', type: 'web-app', domain: 'education-edtech'},
  {templateId: 'pc-operator-ui', name: 'Remote PC Control & Automation Panel', type: 'tool', domain: 'iot-automation'},
  {templateId: 'morpheus-social', name: 'Morpheus Autonomous Social Media Commander', type: 'web-app', domain: 'marketing-seo'},
  {templateId: 'rpg-quest', name: 'Sovereign RPG Quest & Story Engine', type: 'web-app', domain: 'entertainment-gaming'},
  {templateId: 'trivia-battle', name: 'Multiplayer Trivia & Quiz Arena', type: 'web-app', domain: 'entertainment-gaming'},
  {templateId: 'language-lab', name: 'Interactive Language & Vocabulary Lab', type: 'web-app', domain: 'education-edtech'},
  {templateId: 'math-olympiad', name: 'Math & Science Concept Solver', type: 'web-app', domain: 'education-edtech'},
  {templateId: 'habit-forge', name: 'Daily Habit & Wellness Forge', type: 'web-app', domain: 'lifestyle-wellness'},
  {templateId: 'code-craft', name: 'Full-Stack Developer Sandbox & Snippet Studio', type: 'web-app', domain: 'software-dev'},
  {templateId: 'creative-studio', name: 'Interactive Script, Song & Storyboard Studio', type: 'web-app', domain: 'creative-arts'},
  {templateId: 'science-lab', name: 'Biomolecular & Chemistry Research Workbench', type: 'web-app', domain: 'science-discovery'},
  {templateId: 'vite-react-template', name: 'Vite React Modern Frontend Archetype', type: 'web-app', domain: 'software-dev', liveWorker: 'vite-react-template'},
  {templateId: 'chanfana-openapi', name: 'Chanfana OpenAPI 3.0 Backend Archetype', type: 'api', domain: 'cloud-devops', liveWorker: 'chanfana-openapi-template'},
  {templateId: 'react-router-starter', name: 'React Router SSR Full-Stack Archetype', type: 'web-app', domain: 'software-dev', liveWorker: 'react-router-starter-templates'},
  {templateId: 'my-react-app', name: 'React Client SPA Archetype', type: 'web-app', domain: 'software-dev', liveWorker: 'my-react-app'}
];

class UniversalEcosystem {
  constructor() {
    this._synthesizedSkills = new Map();
    this._synthesizedPlugins = new Map();
    this._synthesizedApps = new Map();
    this._loadPredefinedCatalog();
  }

  _loadPredefinedCatalog() {
    // Initialize baseline application templates (not deployed runtime apps)
    for (const app of APPLICATION_TEMPLATES) {
      this._synthesizedApps.set(app.templateId, {
        id: app.templateId,
        name: app.name,
        type: app.type,
        domain: app.domain,
        version: '1.0.0',
        status: 'template',
        persisted: false,
        executable: false,
        verified: false,
        synthesizedAt: new Date().toISOString()
      });
    }
  }

  /**
   * Dynamically registers a skill specification (or in-memory handler if supplied) in Trinity.
   */
  synthesizeSkill(name, domain = 'software-dev', handlerOrOptions = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Skill name must be a non-empty string.');
    }
    const skillId = `skill_${name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    const domainMeta = UNIVERSAL_DOMAINS.find(d => d.id === domain) || UNIVERSAL_DOMAINS[0];
    const hasCustomHandler = typeof handlerOrOptions === 'function';

    const handler = hasCustomHandler
      ? handlerOrOptions
      : async (input) => {
          return {
            skill: skillId,
            domain: domainMeta.id,
            executedAt: new Date().toISOString(),
            status: 'spec_proposed',
            persisted: false,
            executable: false,
            verified: false,
            input,
            message: `Skill '${name}' in domain '${domainMeta.name}' is a proposed specification only (not persisted or executable).`
          };
        };

    const meta = {
      id: skillId,
      name,
      domain: domainMeta.id,
      domainName: domainMeta.name,
      icon: domainMeta.icon,
      version: '1.0.0',
      synthesized: true,
      status: hasCustomHandler ? 'registered_in_memory' : 'spec_proposed',
      persisted: false,
      executable: hasCustomHandler,
      verified: false,
      createdAt: new Date().toISOString()
    };

    // Register in the main SkillRegistry
    skillRegistry.register(skillId, handler, meta);
    this._synthesizedSkills.set(skillId, { handler, meta });

    return meta;
  }

  /**
   * Dynamically creates and registers a new plugin.
   */
  synthesizePlugin(name, domain = 'software-dev', skillNames = []) {
    if (!name || typeof name !== 'string') {
      throw new Error('Plugin name must be a non-empty string.');
    }
    const pluginId = `plugin_${name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    const domainMeta = UNIVERSAL_DOMAINS.find(d => d.id === domain) || UNIVERSAL_DOMAINS[0];

    // Ensure all skills assigned to the plugin exist, synthesizing any missing ones
    const registeredSkillIds = [];
    for (const sName of skillNames) {
      const sId = `skill_${sName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
      if (!skillRegistry.has(sId)) {
        this.synthesizeSkill(sName, domain);
      }
      registeredSkillIds.push(sId);
    }

    const pluginManifest = {
      id: pluginId,
      name,
      domain: domainMeta.id,
      category: domainMeta.id,
      description: `Universal dynamic plugin for domain ${domainMeta.name}.`,
      icon: domainMeta.icon,
      version: '1.0.0',
      skills: registeredSkillIds,
      enabled: true,
      required: false,
      synthesized: true,
      status: 'spec_proposed',
      persisted: false,
      verified: false
    };

    copilotPluginRegistry.register(pluginManifest);
    this._synthesizedPlugins.set(pluginId, pluginManifest);

    return pluginManifest;
  }

  /**
   * Proposes a new application specification in-memory (not persisted or deployed).
   */
  synthesizeApp(name, domain = 'software-dev', options = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Application name must be a non-empty string.');
    }
    const appId = `app_${name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    const domainMeta = UNIVERSAL_DOMAINS.find(d => d.id === domain) || UNIVERSAL_DOMAINS[0];

    const appRecord = {
      id: appId,
      name,
      domain: domainMeta.id,
      domainName: domainMeta.name,
      type: options.type || 'web-app',
      version: '1.0.0',
      prompt: options.prompt || `Create application ${name} for domain ${domainMeta.name}`,
      status: 'spec_proposed',
      persisted: false,
      executable: false,
      verified: false,
      synthesized: true,
      features: options.features || ['Responsive interface', 'Audit logging', 'Offline cache'],
      createdAt: new Date().toISOString()
    };

    this._synthesizedApps.set(appId, appRecord);
    return appRecord;
  }

  /**
   * Searches across the entire ecosystem of applications, plugins, and skills.
   */
  searchCatalog(query = '', options = {}) {
    const q = (query || '').toLowerCase().trim();
    const typeFilter = options.type; // 'app', 'plugin', 'skill', or null for all
    const domainFilter = options.domain;

    const results = {
      apps: [],
      plugins: [],
      skills: [],
      total: 0
    };

    if (!typeFilter || typeFilter === 'app') {
      for (const app of this._synthesizedApps.values()) {
        const matchesQ = !q || app.name.toLowerCase().includes(q) || app.domain.toLowerCase().includes(q);
        const matchesDomain = !domainFilter || app.domain === domainFilter;
        if (matchesQ && matchesDomain) {
          results.apps.push(app);
        }
      }
    }

    if (!typeFilter || typeFilter === 'plugin') {
      const allPlugins = copilotPluginRegistry.list();
      for (const p of allPlugins) {
        const matchesQ = !q || p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
        const matchesDomain = !domainFilter || p.category === domainFilter || p.domain === domainFilter;
        if (matchesQ && matchesDomain) {
          results.plugins.push(p);
        }
      }
    }

    if (!typeFilter || typeFilter === 'skill') {
      const allSkills = skillRegistry.list();
      for (const s of allSkills) {
        const matchesQ = !q || s.name.toLowerCase().includes(q);
        if (matchesQ) {
          results.skills.push(s);
        }
      }
    }

    results.total = results.apps.length + results.plugins.length + results.skills.length;
    return results;
  }

  /**
   * Returns honest catalog statistics for the registered ecosystem.
   */
  getStats() {
    const appsCount = this._synthesizedApps.size;
    const pluginsCount = copilotPluginRegistry.list().length;
    const skillsCount = skillRegistry.list().length;
    const extendedSkillsCount = EXTENDED_SKILLS.length;
    const extendedPluginsCount = EXTENDED_PLUGINS.length;

    return {
      domains_count: UNIVERSAL_DOMAINS.length,
      active_apps: appsCount,
      app_templates_count: APPLICATION_TEMPLATES.length,
      active_plugins: pluginsCount,
      active_skills: skillsCount,
      extended_skills_available: extendedSkillsCount,
      extended_plugins_available: extendedPluginsCount,
      total_catalog_items: appsCount + pluginsCount + skillsCount,
      persisted_runtime_synthesis: false,
      status: 'operational',
      engine: 'Trinity Universal Ecosystem 2.0'
    };
  }
}

export const universalEcosystem = new UniversalEcosystem();
export const synthesizeSkill = (...args) => universalEcosystem.synthesizeSkill(...args);
export const synthesizePlugin = (...args) => universalEcosystem.synthesizePlugin(...args);
export const synthesizeApp = (...args) => universalEcosystem.synthesizeApp(...args);
export const searchCatalog = (...args) => universalEcosystem.searchCatalog(...args);
