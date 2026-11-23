/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module extended-catalog.js (Trinity/src/extended-catalog.js) in the TRINITY OMNI-CORE ecosystem.
 */
// Extended trusted Trinity catalog. Entries use only core tools.
// Bilingual cluster keys preserve matching against Trinity/src/registry.js cluster IDs
// while exposing English canonical cluster names first (used by skillRegistry.js).
const CLUSTER_KEYS = {
  management: ['Management', 'Riadenie'],
  support: ['Support & Automation', 'Podpora a automatizácia'],
  development: ['Development', 'Vývoj'],
  quality: ['Quality & Security', 'Kvalita a bezpečnosť'],
  data: ['Data & Memory', 'Dáta a pamäť'],
  cloud: ['Cloud & Operations', 'Cloud a prevádzka'],
  research: ['Research', 'Výskum'],
  creation: ['Creation', 'Tvorba']
};

const skillGroups = [
  ["delivery", "Delivery", ["Scope", "Requirements", "Milestones", "Dependencies", "Risks", "Acceptance", "Priorities", "Backlog", "Status", "Retrospective"], [...CLUSTER_KEYS.management, ...CLUSTER_KEYS.support]],
  ["software", "Development", ["API contract", "Frontend screen", "Backend service", "Refactoring", "Bug fix", "Database migration", "Test plan", "Performance optimization", "Secure implementation", "Release package"], [...CLUSTER_KEYS.development, ...CLUSTER_KEYS.quality]],
  ["data", "Data", ["Schema design", "Safe SQL", "Record cleaning", "CSV inspection", "Metrics", "Statistical summary", "Data lineage", "Quality checks", "Data minimization", "Data report"], [...CLUSTER_KEYS.data, ...CLUSTER_KEYS.quality]],
  ["cloud", "Cloud", ["Worker configuration", "D1 database", "R2 artifacts", "KV cache", "Queues", "Workflow", "Logs", "Health check", "Cloud incident", "Cost overview"], [...CLUSTER_KEYS.cloud, ...CLUSTER_KEYS.development]],
  ["research", "Research", ["Web search", "Source selection", "Evidence map", "Option comparison", "Technical documentation", "Fact verification", "Literature summary", "Market overview", "Timeline", "Research report"], [...CLUSTER_KEYS.research, ...CLUSTER_KEYS.data]],
  ["writing", "Writing", ["Outline", "Slovak text", "English text", "Technical documentation", "Marketing copy", "Copyediting", "Translation", "Communication tone", "SEO copy", "Citations"], [...CLUSTER_KEYS.creation, ...CLUSTER_KEYS.research]],
  ["design", "Design", ["UX flow", "UI screen", "Accessible interface", "Information architecture", "Prototype", "Visual system", "Content design", "Responsive layout", "Component", "Design audit"], [...CLUSTER_KEYS.creation, ...CLUSTER_KEYS.quality]],
  ["security", "Security", ["Threat model", "Secrets", "Authentication", "Permissions", "Input validation", "Privacy protection", "Security audit", "Supply chain", "Incident response", "Post-attack recovery"], [...CLUSTER_KEYS.quality, ...CLUSTER_KEYS.cloud]],
  ["automation", "Automation", ["Workflow", "Retries", "Idempotency", "Run scheduling", "Approvals", "Notifications", "Integration", "Data import", "Data export", "Automation audit"], [...CLUSTER_KEYS.support, ...CLUSTER_KEYS.cloud]],
  ["support", "Support", ["Diagnostics", "Bug reproduction", "Triage", "Root cause", "Runbook", "User reply", "Escalation", "FAQ", "Knowledge base", "Handoff"], [...CLUSTER_KEYS.support, ...CLUSTER_KEYS.quality]],
  ["finance", "Finance", ["Budget", "Cost model", "Cashflow", "Paper portfolio", "Risk limits", "Scenarios", "Tax overview", "Invoice", "Unit economics", "Financial report"], [...CLUSTER_KEYS.data, ...CLUSTER_KEYS.research]],
  ["personal", "Personal Organization", ["Tasks", "Calendar", "Habits", "Notes", "Focus", "Goals", "Learning", "Travel", "Household", "Personal overview"], [...CLUSTER_KEYS.management, ...CLUSTER_KEYS.data]],
  ["media", "Media", ["Image brief", "Image prompt", "Alt text", "Video plan", "Content calendar", "Transcript", "Subtitles", "Content moderation", "Brand asset", "Media library"], [...CLUSTER_KEYS.creation, ...CLUSTER_KEYS.quality]],
  ["quality", "Quality", ["Checklist", "Unit tests", "Regression", "Edge cases", "Peer review", "Result evidence", "Acceptance tests", "Documentation QA", "Accessibility QA", "Release gate"], [...CLUSTER_KEYS.quality, ...CLUSTER_KEYS.support]],
];

export const EXTENDED_SKILLS = skillGroups.flatMap(([key, category, names, clusters]) => names.map((name, index) => ({
  id: `${key}-${String(index + 1).padStart(2, '0')}`,
  name: `${category}: ${name}`,
  description: `${name}: define a concrete procedure, list inputs, verifiable outputs, and remaining constraints.`,
  clusters,
  keywords: [name.toLowerCase(), category.toLowerCase(), key],
  steps: [
    `identify inputs and boundaries for ${name.toLowerCase()}`,
    'select only available and authorized tools',
    'execute or prepare the result with explicit status labeling',
    'verify output against acceptance criteria'
  ],
  success_checks: [
    'output is independently verifiable',
    'facts, estimates, and proposals are clearly separated',
    'no action is marked completed without an executed tool receipt'
  ]
})));

const pluginGroups = [
  ["productivity", "Productivity", ["Task inbox", "Daily agenda", "Goals", "Notes", "Focus plan", "Prioritization", "Checklists"]],
  ["developer", "Development", ["API contracts", "Code review", "File diff", "Release package", "Dependencies", "Changelog", "Technical docs"]],
  ["data", "Data", ["JSON lab", "CSV lab", "Table filters", "Statistics", "Deduplication", "Data redaction", "Data schema"]],
  ["cloud", "Cloud", ["Worker diagnostics", "D1 overview", "R2 archive", "KV overview", "Queue plan", "Workflow monitor", "Cloud health"]],
  ["research", "Research", ["Source radar", "Source comparison", "Evidence map", "Fact-check", "Technical reader", "Market scanner", "Research archive"]],
  ["content", "Content", ["Markdown pack", "HTML cleaner", "Translation pack", "Text tone", "SEO check", "Citations", "Text editor"]],
  ["design", "Design", ["Colors", "Contrast", "UI components", "UX checklist", "Image prompt", "Alt text", "Layout plan"]],
  ["security", "Security", ["Security headers", "Secret vault", "Auth checklist", "Permission audit", "Input guard", "Privacy scrubber", "Evidence audit"]],
  ["automation", "Automation", ["Workflow builder", "Retry plan", "Idempotency check", "Approval flow", "Notifications", "Import pipeline", "Export pipeline"]],
  ["support", "Support", ["Diagnostics", "Incident kit", "Runbook", "Ticket triage", "FAQ builder", "Handoff pack", "Status report"]],
  ["finance", "Finance", ["Budget board", "Calculations", "Paper trading", "Scenarios", "Unit metrics", "Invoice helper", "Finance report"]],
  ["time", "Time", ["Date timeline", "Time zone", "Duration", "Business days", "Recurrence", "Clock board", "Deadline guard"]],
  ["integration", "Integrations", ["MCP registry", "Connector check", "GitHub brief", "Cloudflare brief", "PC Bridge", "Email prep", "Webhook contract"]],
  ["media", "Media", ["Image brief", "Asset metadata", "Caption maker", "Transcript prep", "Moderation", "Brand kit", "Gallery index"]],
  ["planning", "Planning", ["Roadmap", "Scope guard", "Risk register", "Backlog board", "Milestones", "Requirements", "Acceptance gate"]],
];

const pluginTools = ['plan_work','search_memory','project_snapshot','service_status','calculate','analyze_text','current_time','json_tool','hash_text','convert_units','extract_entities','format_text','date_math','timezone_convert','statistics','csv_inspect','csv_to_json','text_diff','list_cleaner','table_transform','url_inspect','query_string','color_convert','contrast_check','base64_codec','uuid_tool','semver_compare','redact_sensitive','markdown_inspect','html_to_text','business_math','geometry','web_search','generate_image','list_capabilities','list_skills','list_connectors'];
const icons = ['◇','◈','▦','◎','⌁','±','Aa','✓','↔','◉','Σ','▤','⇄','⌕','✳'];
export const EXTENDED_PLUGINS = pluginGroups.flatMap(([key, category, names], groupIndex) => names.map((name, index) => {
  const id = `${key}-pack-${String(index + 1).padStart(2, '0')}`;
  const tool = key === 'research' ? 'web_search' : key === 'design' && index === 4 ? 'generate_image' : pluginTools[(groupIndex * 7 + index) % pluginTools.length];
  const dependency = key === 'cloud' ? 'Cloudflare bindings' : key === 'developer' ? 'Trinity runtime' : key === 'data' ? 'Worker runtime' : key === 'integration' ? 'Authorized connector' : key === 'finance' ? 'D1 paper ledger' : 'Trinity core';
  return {id, name: `${category}: ${name}`, icon: icons[groupIndex], description: `Trusted pack for ${name.toLowerCase()}; uses existing tool ${tool} and neither fetches nor executes external code.`, tools: [tool], dependency, version: '1.0.0', category: key, trusted: true};
}));
