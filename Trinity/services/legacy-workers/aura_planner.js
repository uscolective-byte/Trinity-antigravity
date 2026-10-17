// Reconciled with the deployed Worker on 2026-10-17; retain both deployed and repository actions.
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "plan.task") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Planner. Rozdeľ úlohu na konkrétne kroky. VRÁŤ JSON: {steps:[{title,description,estimated_minutes,dependencies:[],priority}],summary,risks:[]}" },
          { role: "user", content: "Úloha: " + (d.task || d.title || "") + "\nKontext: " + (d.context || "") }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO tasks (id, title, description, status, assigned_agent, priority, created_at, updated_at) VALUES (?,?,?,?, 'planner', ?, datetime('now'), datetime('now'))").bind(id, d.task||d.title||"plan", JSON.stringify(result), 'pending', d.priority||'normal').run();
        if (result.steps) {
          for (const s of result.steps) {
            await env.DB.prepare("INSERT INTO autonomous_tasks (id, title, description, status, priority, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, 'pending', ?, datetime('now'))").bind(s.title, s.description, s.priority||'normal').run();
          }
        }
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.project") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Planner. Vytvor projektový plán s míľnikmi. VRÁŤ JSON: {milestones:[{name,deliverables:[],deadline_estimate,dependencies:[]}],timeline,resources_needed:[]}" },
          { role: "user", content: "Projekt: " + (d.project || "") + "\nCiele: " + (d.goals || "") + "\nObmedzenia: " + (d.constraints || "") }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        await env.DB.prepare("INSERT INTO ops_roadmap (id, title, status, priority, created_at) VALUES (lower(hex(randomblob(16))), ?, 'planned', ?, datetime('now'))").bind(d.project||"project", d.priority||"normal").run();
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.sprint") {
        const tasks = await env.DB.prepare("SELECT id, title, description, priority FROM autonomous_tasks WHERE status = 'pending' ORDER BY CASE WHEN priority='critical' THEN 0 WHEN priority='high' THEN 1 ELSE 2 END LIMIT 20").all();
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Planner. Organizuj úlohy do šprintu. VRÁŤ JSON: {sprint:{name,duration_days,tasks:[{id,title,story_points,day_assignment}],capacity_notes}}" },
          { role: "user", content: "Dostupné úlohy: " + JSON.stringify(tasks.results) + "\nKapacita: " + (d.capacity || "5 days") }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.timeline") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Planner. Odhadni časovú líniu pre sadu úloh. VRÁŤ JSON: {total_hours,critical_path:[],parallel_tracks:[],bottlenecks:[]}" },
          { role: "user", content: "Úlohy: " + JSON.stringify(d.tasks || []) }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.create") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Planner. Vytvor krok-za-krokom plán. Pre každý krok: akcia, agent, odhadovaný čas, závislosti. JSON: {steps:[{action, agent, time, deps}]}" },
          { role: "user", content: "Cieľ: " + d.goal }
        ]});
        let plan; try { plan = JSON.parse(ai.response); } catch { plan = { raw: ai.response }; }
        const goalId = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO goals (id, goal, priority, status, owner, created_at, updated_at) VALUES (?, ?, ?, 'active', 'aura-planner', datetime('now'), datetime('now'))").bind(goalId, d.goal, d.priority||5).run();
        return Response.json({ ok: true, result: { goalId, plan }, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.decompose") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Planner. Rozdeľ úlohu na menšie podúlohy. JSON: {subtasks:[{title, description, priority, assigned_agent}]}" },
          { role: "user", content: "Úloha: " + d.task }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        if (result.subtasks) {
          for (const t of result.subtasks) {
            const id = crypto.randomUUID();
            await env.DB.prepare("INSERT INTO tasks (id, title, description, status, assigned_agent, project_id, priority, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, NULL, ?, datetime('now'), datetime('now'))").bind(id, t.title, t.description||"", t.assigned_agent||"auto", t.priority||"normal").run();
          }
        }
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.goals") {
        const r = await env.DB.prepare("SELECT id, goal, priority, status, owner, created_at FROM goals WHERE status = 'active' ORDER BY priority DESC").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-planner" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "planner", role: "Plánuje a rozdeľuje úlohy, vytvára ciele", status: "active" }, traceId, from: "aura-planner" });
      }
      return Response.json({ ok: false, error: "Unknown action: " + call.action, traceId, from: "aura-planner" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-planner" }); }
  }
};
