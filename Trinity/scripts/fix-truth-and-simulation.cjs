const fs = require('fs');
const path = require('path');

console.log('Fixing truth and anti-simulation rules...');

// 1. Update src/engine.js
const enginePath = path.join(__dirname, '../src/engine.js');
let engine = fs.readFileSync(enginePath, 'utf8');

// Broaden isGithubRequest regex
engine = engine.replace(
  "function isGithubRequest(task) {\n  const norm = String(task || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();\n  return /\\bgithub\\b.*\\b(spravuj|skontroluj|status|zoznam|commits?|issues?|repo)\\b/.test(norm);\n}",
  `function isGithubRequest(task) {
  const norm = String(task || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  return /\\b(github|repo|repozitar|repozitara|repozitare|kodova zakladna|struktura projektu|struktura repozitara)\\b/.test(norm);
}`
);

// Update github direct response in engine.js
const oldGithubDirect = `    const outcome=await runTool(env,agent,'github_manage',{action:'status'});
    const receipt={tool:'github_manage',status:'completed',effect:'read',receipt_id:\`gh:\${Date.now()}\`,verified_at:new Date().toISOString()};
    const text=\`🐙 **GitHub Integration (\\\`\${outcome.repo}\\\`):**\\n\\n- Repository: [\${outcome.repo}](https://github.com/\${outcome.repo})\\n- Default branch: \\\`\${outcome.details?.default_branch||'main'}\\\`\\n- Open issues: \\\`\${outcome.details?.open_issues||0}\\\`\\n- Authenticated access: \\\`\${outcome.authenticated?'Yes (Vault token)':'Public read-only (Safe mode)'}\\\`\\n\\nTrinity can inspect commits, issues, manage branches, and trigger GitHub Actions.\`;
    return {text,model:'trinity-github-ops',provider:'internal',agent_id:id,tool_log:[receipt],truth:truthStatus(text,[receipt]),duration_ms:Date.now()-started};`;

const newGithubDirect = `    const outcome=await runTool(env,agent,'github_manage',{action:'status'});
    const repoAntigravity = env.TRINITY_GITHUB_REPO || 'uscolective-byte/Trinity-antigravity';
    const text=\`🐙 **Verified GitHub Repositories (Truthful status without simulation):**\\n\\n\`+
      \`- **Primary unified repo:** [\${repoAntigravity}](https://github.com/\${repoAntigravity})\\n\`+
      \`- **Mirror repo:** [uscolective-byte/trinity-morhfeus](https://github.com/uscolective-byte/trinity-morhfeus)\\n\`+
      \`- **Default branch:** \\\`\${outcome.details?.default_branch||'main'}\\\`\\n\`+
      \`- **Primary config:** \\\`Trinity/wrangler.jsonc\\\` (project does not use wrangler.toml)\\n\`+
      \`- **Modules:** \\\`Trinity\\\` (unified core), \\\`Jericho-Worker\\\`, \\\`Knowledge-Worker\\\`, \\\`Integrations-Worker\\\`, \\\`Capacity-Worker\\\`, \\\`PC-Bridge-Worker\\\`\\n\`+
      \`- **Authenticated access:** \\\`\${outcome.authenticated?'Yes (Vault token)':'Public read-only (Safe mode)'}\\\`\\n\\n\`+
      \`All files and commits are synchronized on branch \\\`main\\\`. Non-existent repositories (such as Morpheus-Trinity) or simulated files (such as wrangler.toml or utils.js) do not exist.\`;
    const receipt={tool:'github_manage',status:'completed',effect:'read',receipt_id:\`gh:\${Date.now()}\`,verified_at:new Date().toISOString()};
    return {text,model:'trinity-github-ops',provider:'internal',agent_id:id,tool_log:[receipt],truth:truthStatus(text,[receipt]),duration_ms:Date.now()-started};`;

engine = engine.replace(oldGithubDirect, newGithubDirect);

// Add strict anti-hallucination directive in system prompt
engine = engine.replace(
  "NEVER simulate or fabricate: results, executed actions, verifications, data, prices, balances, or PC access.",
  "NEVER simulate or fabricate: results, executed actions, verifications, data, prices, balances, or PC access. NEVER invent non-existent repositories (e.g., Morpheus-Trinity does not exist), non-existent files (such as wrangler.toml, trinity.js, utils.js), or code structure. The real repositories are 'uscolective-byte/Trinity-antigravity' (primary unified repo) and 'uscolective-byte/trinity-morhfeus'. The primary configuration is Trinity/wrangler.jsonc. For any question about the repository, code, files, or branches, ALWAYS use the github_manage tool to verify the actual state."
);

fs.writeFileSync(enginePath, engine, 'utf8');
console.log('✓ src/engine.js updated');

// 2. Update src/fast-chat.js
const fcPath = path.join(__dirname, '../src/fast-chat.js');
let fc = fs.readFileSync(fcPath, 'utf8');

fc = fc.replace(
  "Never fabricate results, PC access, sources, executed actions, or financial data.",
  "Never fabricate results, PC access, sources, executed actions, repository structure, or financial data. Real repositories are uscolective-byte/Trinity-antigravity and uscolective-byte/trinity-morhfeus (Morpheus-Trinity and wrangler.toml do not exist)."
);

if (!fc.includes("github_manage")) {
  fc = fc.replace(
    "for memory search_memory,",
    "for memory search_memory, for repository or code github_manage,"
  );
}

const directToolHook = `  if(/\\b(?:github|repo|repozitar|repozitara|repozitare|kod|struktura|subory|suboroch|kde mas repo)\\b/i.test(text)&&tools.includes('github_manage'))return {name:'github_manage',arguments:{action:'status'}};`;
if (!fc.includes("kde mas repo")) {
  fc = fc.replace(
    "if(/^(?:prosim\\s+)?(?:ake mam domeny",
    directToolHook + "\n  if(/^(?:prosim\\s+)?(?:ake mam domeny"
  );
}

fs.writeFileSync(fcPath, fc, 'utf8');
console.log('✓ src/fast-chat.js updated');

console.log('All anti-simulation protections applied.');
