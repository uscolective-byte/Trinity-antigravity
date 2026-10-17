// Reconciled with the deployed Worker on 2026-10-17; retain both deployed and repository actions.
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "architect.design") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Architect. Navrhni systémovú architektúru. VRÁŤ JSON: {components:[{name,responsibility,technology,connections:[]}],data_flow,scalability_notes,security_notes}" },
          { role: "user", content: "Požiadavky: " + (d.requirements || "") + "\nŠkála: " + (d.scale || "medium") + "\nObmedzenia: " + (d.constraints || "") }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        await env.DB.prepare("INSERT INTO thoughts (id, thought_type, content, trigger_message, resulting_action, created_at) VALUES (?, 'architecture', ?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), JSON.stringify(result), d.requirements||"", "architect.design").run();
        return Response.json({ ok: true, result, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.review") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Architect. Zhodnoť architektúru. VRÁŤ JSON: {score,strengths:[],weaknesses:[],recommendations:[],risk_level}" },
          { role: "user", content: "Architektúra na review:\n" + (d.architecture || d.description || "") }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.evaluate") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Architect. Vyhodnoť technologické možnosti. VRÁŤ JSON: {recommendation,alternatives:[{name,pros:[],cons:[],fit_score}],reasoning}" },
          { role: "user", content: "Problém: " + (d.problem || "") + "\nMožnosti: " + JSON.stringify(d.options || []) }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.diagram") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Architect. Generuj textovú reprezentáciu architektúry (Mermaid diagram). VRÁŤ JSON: {mermaid,description,legend:[]}" },
          { role: "user", content: "Systém: " + (d.system || "") + "\nKomponenty: " + (d.components || "") }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.graph") {
        const nodes = await env.DB.prepare("SELECT id, type, label, content FROM graph_nodes ORDER BY created_at DESC LIMIT 50").all();
        const edges = await env.DB.prepare("SELECT id, source_id, target_id, relation FROM graph_edges ORDER BY created_at DESC LIMIT 50").all();
        return Response.json({ ok: true, result: { nodes: nodes.results, edges: edges.results }, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.node.add") {
        await env.DB.prepare("INSERT INTO graph_nodes (id, type, label, properties, content, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, '{}', ?, datetime('now'))").bind(d.type||"concept", d.label, d.content||"").run();
        return Response.json({ ok: true, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.edge.add") {
        await env.DB.prepare("INSERT INTO graph_edges (id, source_id, target_id, relation, weight, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'))").bind(d.source_id, d.target_id, d.relation||"related", d.weight||1.0).run();
        return Response.json({ ok: true, traceId, from: "aura-architect" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "architect", role: "Navrhuje systémovú architektúru a komponenty", status: "active" }, traceId, from: "aura-architect" });
      }
      return Response.json({ ok: false, error: "Unknown action: " + call.action, traceId, from: "aura-architect" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-architect" }); }
  }
};
