// Reconciled with the deployed Worker on 2026-10-17; retain both deployed and repository actions.
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "codegen.generate") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Generuj čistý, produkčný kód. VRÁŤ JSON: {code,language,explanation,dependencies:[]}" },
          { role: "user", content: "Špecifikácia: " + (d.spec || d.description || "") + "\nJazyk: " + (d.language || "javascript") + "\nTyp: " + (d.type || "function") }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        await env.DB.prepare("INSERT INTO code_snippets (id, title, language, code, tags, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'generated', datetime('now'))").bind(d.title||"generated", d.language||"javascript", result.code || result.raw || "").run();
        return Response.json({ ok: true, result, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.refactor") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Refaktorizuj kód pre čitateľnosť, výkon a udržiavateľnosť. VRÁŤ JSON: {refactored_code,changes:[],improvements:[]}" },
          { role: "user", content: "Kód na refaktorizáciu:\n" + (d.code || "") + "\nPoznámky: " + (d.notes || "") }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        await env.DB.prepare("INSERT INTO code_snippets (id, title, language, code, tags, created_at) VALUES (lower(hex(randomblob(16))), 'refactored', ?, ?, 'refactored', datetime('now'))").bind(d.language||"javascript", result.refactored_code || result.raw || "").run();
        return Response.json({ ok: true, result, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.scaffold") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Vytvor scaffold projekt štruktúry. VRÁŤ JSON: {files:[{path,content}],structure_description,setup_instructions}" },
          { role: "user", content: "Typ projektu: " + (d.project_type || "worker") + "\nNázov: " + (d.name || "new-project") + "\nFunkcie: " + (d.features || "") }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        if (result.files) {
          for (const f of result.files) {
            await env.DB.prepare("INSERT INTO code_snippets (id, title, language, code, tags, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'scaffold', datetime('now'))").bind(f.path, d.language||"javascript", f.content).run();
          }
        }
        return Response.json({ ok: true, result, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.docs") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Generuj dokumentáciu pre kód. VRÁŤ JSON: {documentation,api_endpoints:[],examples:[]}" },
          { role: "user", content: "Kód:\n" + (d.code || "") + "\nFormát: " + (d.format || "markdown") }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.sql") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Generuj SQL pre SQLite/D1. Iba SQL, žiadne vysvetlenie." },
          { role: "user", content: d.prompt }
        ]});
        return Response.json({ ok: true, result: { sql: ai.response }, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.migration") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Generuj D1 migráciu. Iba SQL." },
          { role: "user", content: "Tabuľka: " + d.table + " Stĺpce: " + d.columns }
        ]});
        return Response.json({ ok: true, result: { migration: ai.response }, traceId, from: "aura-codegen" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "codegen", role: "Generuje produkčný kód, SQL, migrácie", status: "active" }, traceId, from: "aura-codegen" });
      }
      return Response.json({ ok: false, error: "Unknown action: " + call.action, traceId, from: "aura-codegen" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-codegen" }); }
  }
};
