$root = "C:\Users\saboi\Trinity\Trinity-antigravity"
Set-Location $root

Write-Host "[TRINITY] Inicializujem adresárovú štruktúru..." -ForegroundColor Cyan
$dirs = @("agent_engine", "app\api\agent", "app\api\builder", "app\api\skills", "core", "skills", "memory", "generated_apps", "data")
foreach ($d in $dirs) {
    $path = Join-Path $root $d
    if (-not (Test-Path $path)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
}

Write-Host "[TRINITY] Generujem súbor agent_engine/agents.py..." -ForegroundColor Green
$agentsPy = @"
from functools import cached_property
from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.genai import Client
from google.adk.tools import agent_tool
from google.adk.tools.google_search_tool import GoogleSearchTool
from google.adk.tools import url_context

class GlobalGemini(Gemini):
    @cached_property
    def api_client(self) -> Client:
        return Client(vertexai=True, location="global")

app_builder_agent = LlmAgent(
    name='app_builder_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Generates complete multi-file project structures and application code.',
    instruction='You are the Application Builder sub-agent for TRINITY. Generate complete, production-ready codebases.',
)

devops_deploy_agent = LlmAgent(
    name='devops_deploy_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Specializes in Git workflows, CI/CD, and cloud deployments.',
    instruction='You are the DevOps & Cloud Specialist sub-agent for TRINITY.',
)

research_specialist_google_search_agent = LlmAgent(
    name='Research_Specialist_google_search_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Agent specialized in Google searches.',
    instruction='Use the GoogleSearchTool to find information.',
    tools=[GoogleSearchTool()],
)

research_specialist_url_context_agent = LlmAgent(
    name='Research_Specialist_url_context_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Agent specialized in fetching URL content.',
    instruction='Use the UrlContextTool to retrieve content.',
    tools=[url_context],
)

research_agent = LlmAgent(
    name='research_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Performs web research and documentation lookups.',
    instruction='You are the Research Specialist sub-agent for TRINITY.',
    tools=[
        agent_tool.AgentTool(agent=research_specialist_google_search_agent),
        agent_tool.AgentTool(agent=research_specialist_url_context_agent)
    ],
)

security_audit_agent = LlmAgent(
    name='security_audit_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Audits codebases for security vulnerabilities.',
    instruction='You are the Security & Code Auditor sub-agent for TRINITY.',
)

qa_test_agent = LlmAgent(
    name='qa_test_agent',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Creates comprehensive test suites.',
    instruction='You are the QA & Test Engineer sub-agent for TRINITY.',
)

database_architect = LlmAgent(
    name='database_architect',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Designs database schemas and migrations.',
    instruction='You are the Database Architect sub-agent for TRINITY.',
)

root_agent = LlmAgent(
    name='TRINITY_Core',
    model=GlobalGemini(model='gemini-3.5-flash'),
    description='Central orchestration hub and lead AI systems architect.',
    sub_agents=[
        app_builder_agent,
        devops_deploy_agent,
        research_agent,
        security_audit_agent,
        qa_test_agent,
        database_architect
    ],
    instruction='You are TRINITY Core, an advanced autonomous AI systems architect and central operational hub.',
)
"@
Set-Content -Path (Join-Path $root "agent_engine\agents.py") -Value $agentsPy -Encoding UTF8

Write-Host "[TRINITY] Generujem súbor agent_engine/main.py..." -ForegroundColor Green
$mainPy = @"
import os
from flask import Flask, request, jsonify
from agents import root_agent

app = Flask(__name__)

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ONLINE",
        "system": "TRINITY_Core Multi-Agent ADK",
        "sub_agents": [
            "app_builder_agent", "devops_deploy_agent", "research_agent",
            "security_audit_agent", "qa_test_agent", "database_architect"
        ]
    })

@app.route("/api/execute", methods=["POST"])
def execute_plan():
    data = request.get_json() or {}
    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"error": "Prompt je povinný"}), 400
    try:
        response = root_agent.run(prompt)
        return jsonify({
            "status": "SUCCESS",
            "orchestrator": "TRINITY_Core",
            "result": str(response)
        })
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
"@
Set-Content -Path (Join-Path $root "agent_engine\main.py") -Value $mainPy -Encoding UTF8

Write-Host "[TRINITY] Generujem a vkladám bezpečnostné kľúče do .env..." -ForegroundColor Yellow
$randomToken = -join ((48..57) + (97..122) | Get-Random -Count 24 | % {[char]$_})
$masterAdminKey = "trinity_master_secret_$randomToken"

$envContent = @"
NODE_ENV=development
ADMIN_API_KEY=$masterAdminKey
GEMINI_API_KEY=tu_vloz_svoj_gemini_api_kluc_z_ai_studio
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_LOCATION=global
PORT=3000
PYTHON_SERVER_PORT=8000
"@
Set-Content -Path (Join-Path $root ".env") -Value $envContent -Encoding UTF8
Write-Host "[✔] Vygenerovaný ADMIN_API_KEY: $masterAdminKey (uložené v .env)" -ForegroundColor Cyan

Write-Host "[TRINITY] Inštalujem Python a Node.js závislosti..." -ForegroundColor Cyan
pip install -r requirements.txt
npm install

Write-Host "[✔] TRINITY OMNI-CORE je kompletne pripravená!" -ForegroundColor Green
Write-Host "Teraz môžeš spustiť rozhranie príkazom: npm run dev" -ForegroundColor Yellow
/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AUTOMATION_AND_OPS_SCRIPTS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul audit-local-provider-keys.mjs (scripts/audit-local-provider-keys.mjs) v ekosystéme TRINITY OMNI-CORE.
 */
// Explicitly scoped audit of the owner's known Trinity configuration.
// Never print values, fingerprints, raw provider responses or request headers.
import {readFile,writeFile} from 'node:fs/promises';
const path='C:/Users/saboi/OneDrive/trinity/.env';
const buffer=await readFile(path);
const utf16le=(buffer[0]===0xff&&buffer[1]===0xfe)||(buffer.length>3&&buffer[1]===0&&buffer[3]===0);
const raw=buffer.toString(utf16le?'utf16le':'utf8').replace(/^\uFEFF/,'');
const entries=new Map();
for(const line of raw.split(/\r?\n/)){
  const match=line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if(match)entries.set(match[1],match[2].trim().replace(/^(['"])(.*)\1$/,'$2'));
}
const checks=[];
for(const spec of [
  {provider:'openai',name:'OPENAI_API_KEY',pattern:/^sk-[A-Za-z0-9_-]{20,}$/,url:'https://api.openai.com/v1/models'},
  {provider:'anthropic',name:'ANTHROPIC_API_KEY',pattern:/^sk-ant-[A-Za-z0-9_-]{20,}$/,url:'https://api.anthropic.com/v1/models'}
]){
  const key=entries.get(spec.name);
  const row={provider:spec.provider,source_file:path,variable:spec.name,present:!!key,verified:false};
  if(!key||!spec.pattern.test(key)||/placeholder|your[_-]?api|example|replace[_-]?me/i.test(key))row.status='missing-or-placeholder-or-unrecognized-format';
  else{
    try{
      const headers=spec.provider==='openai'?{Authorization:'Bearer '+key}:{'x-api-key':key,'anthropic-version':'2023-06-01'};
      const response=await fetch(spec.url,{headers,signal:AbortSignal.timeout(10000),redirect:'error'});
      row.http_status=response.status;
      row.verified=response.ok;row.status=response.ok?'models-read-verified':'provider-rejected-or-unavailable';
      await response.body?.cancel();
    }catch{row.status='request-failed-or-timed-out';}
  }

import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../.env', import.meta.url);
const buffer = await readFile(path);
const utf16le = (buffer[0] === 0xff && buffer[1] === 0xfe) ||
    (buffer.length > 3 && buffer[1] === 0 && buffer[3] === 0);
const raw = buffer.toString(utf16le ? 'utf16le' : 'utf8').replace(/^\uFEFF/, '');
const entries = new Map();

for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match) entries.set(match[1], match[2].trim().replace(/^(['"])(.*)\1$/, '$2'));
}

const checks = [];
for (const spec of [
    { provider: 'openai', name: 'OPENAI_API_KEY', pattern: /^sk-[A-Za-z0-9_-]{20,}$/, url: 'https://api.openai.com/v1/models' },
    { provider: 'anthropic', name: 'ANTHROPIC_API_KEY', pattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/, url: 'https://api.anthropic.com/v1/models' },
]) {
    const key = entries.get(spec.name);
    const row = { provider: spec.provider, source_file: path.pathname, variable: spec.name, present: !!key, verified: false };

    if (!key || !spec.pattern.test(key) || /placeholder|your[_-]?api|example|replace[_-]?me/i.test(key)) {
        row.status = 'missing-or-placeholder-or-unrecognized-format';
    } else {
        try {
            const headers = spec.provider === 'openai'
                ? { Authorization: `Bearer ${key}` }
                : { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
            const response = await fetch(spec.url, { headers, signal: AbortSignal.timeout(10000), redirect: 'error' });
            row.http_status = response.status;
            row.verified = response.ok;
            row.status = response.ok ? 'models-read-verified' : 'provider-rejected-or-unavailable';
            await response.body?.cancel();
        } catch {
            row.status = 'request-failed-or-timed-out';
        }
    }
    checks.push(row);
}

const report = {
    checked_at: new Date().toISOString(),
    scope: 'known-local-trinity-env-only',
    secret_values_exported: false,
    provider_accounts_created: false,
    checks,
};
const reportPath = new URL('../verification/local-provider-key-audit.json', import.meta.url);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
