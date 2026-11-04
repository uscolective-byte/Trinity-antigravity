"use client";

import React, { useState, useEffect } from "react";

import {
  Terminal,
  Shield,
  Cpu,
  Database,
  Play,
  Code,
  RefreshCw,
  Layers
} from "lucide-react";

type AgentStep = {
  stepNumber?: number;
  thought?: string;
  action?: {
    tool?: string;
  };
  observation?: unknown;
};

type AgentResponse = {
  status?: string;
  error?: string;
  data?: {
    steps?: AgentStep[];
    finalAnswer?: string;
  };
};

const INITIAL_LOGS = [
  "[KERNEL] TRINITY OMNI-CORE",
  "[SECURITY] Sovereign Lock: vyžaduje overenie backendom",
  "[AGENTS] Čakám na potvrdenie dostupnosti agentov",
  "[STATUS] Konzola pripravená na zadanie"
];

const AGENTS = [
  "app_builder_agent",
  "devops_deploy_agent",
  "research_agent",
  "security_audit_agent",
  "qa_test_agent",
  "database_architect"
];

export default function TrinityDashboard() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [skillsCount, setSkillsCount] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>(INITIAL_LOGS);
  const [apiOnline, setApiOnline] = useState(false);

  const appendLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const refreshSkills = async () => {
    try {
      const res = await fetch("/api/skills", {
        cache: "no-store"
      });

      if (!res.ok) {
        throw new Error(`Skills HTTP ${res.status}`);
      }

      const data = await res.json();

      if (
        typeof data.total === "number" &&
        Number.isFinite(data.total)
      ) {
        setSkillsCount(data.total);
      } else {
        setSkillsCount(null);
      }
    } catch {
      setSkillsCount(null);
    }
  };

  useEffect(() => {
    void refreshSkills();
  }, []);

  const handleRunAgent = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    const currentPrompt = prompt.trim();

    if (!currentPrompt || isLoading) return;

    setPrompt("");
    setIsLoading(true);

    appendLog(`> PRÍKAZ: "${currentPrompt}"`);
    appendLog("[TRINITY] Odosielam požiadavku agentovi...");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: currentPrompt
        })
      });

      if (!res.ok) {
        setApiOnline(false);
        throw new Error(`HTTP ${res.status}`);
      }

      const data: AgentResponse = await res.json();

      if (data.status === "SUCCESS") {
        setApiOnline(true);

        const steps = Array.isArray(data.data?.steps)
          ? data.data.steps
          : [];

        for (const step of steps) {
          appendLog(
            `[Krok ${step.stepNumber ?? "?"}] ${
              step.thought ?? "Bez popisu"
            }`
          );

          if (step.action?.tool) {
            appendLog(
              `-> NÁSTROJ: ${step.action.tool}`
            );
          }

          if (step.observation !== undefined) {
            const observation =
              typeof step.observation === "object"
                ? JSON.stringify(step.observation)
                : String(step.observation);

            appendLog(
              `<- VÝSLEDOK: ${observation}`
            );
          }
        }

        if (typeof data.data?.finalAnswer === "string") {
          appendLog(
            `✔ ODPOVEĎ AGENTA: ${data.data.finalAnswer}`
          );
        } else {
          appendLog(
            "[WARNING] Agent nevrátil finálnu odpoveď."
          );
        }

        appendLog(
          "[VERIFY] Úspech operácií vyžaduje platné receipts."
        );

        await refreshSkills();
      } else {
        setApiOnline(false);

        appendLog(
          `✖ CHYBA: ${data.error ?? "Neznáme zlyhanie"}`
        );
      }
    } catch (err: unknown) {
      setApiOnline(false);

      const message =
        err instanceof Error
          ? err.message
          : String(err);

      appendLog(
        `✖ KRITICKÁ CHYBA: ${message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-emerald-400 font-mono flex flex-col p-4 md:p-8">

      <header className="border-b border-emerald-950 pb-5 mb-6 flex flex-wrap items-center justify-between gap-4">

        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-emerald-950/60 border border-emerald-800">
            <Cpu className="w-6 h-6 text-emerald-400" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-wider text-white">
              TRINITY // OMNI-CORE
            </h1>

            <p className="text-xs text-emerald-600">
              Multi-Agent Control Center
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">

          <span className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-950 border border-emerald-900">
            <Shield className="w-4 h-4" />
            SOVEREIGN LOCK
          </span>

          <span className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-950 border border-emerald-900">
            <Layers className="w-4 h-4" />
            6 definovaných agentov
          </span>

          <span className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-950 border border-emerald-900">
            <Code className="w-4 h-4" />
            Skilly: {skillsCount ?? "Neoverené"}
          </span>

          <span className={`px-3 py-2 rounded border ${
            apiOnline
              ? "text-green-400 border-green-800"
              : "text-yellow-400 border-yellow-800"
          }`}>
            API: {apiOnline ? "Odpovedá" : "Neoverené"}
          </span>

        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">

        <div className="flex flex-col gap-5">

          <section className="bg-zinc-950 border border-emerald-950 rounded-lg p-5">

            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Riadiaca konzola
            </h2>

            <form
              onSubmit={handleRunAgent}
              className="flex flex-col gap-3"
            >

              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Zadaj úlohu pre Trinity..."
                className="w-full h-40 bg-black border border-emerald-900 rounded p-3 text-sm text-emerald-300 placeholder-zinc-700 focus:outline-none focus:border-emerald-500 resize-none"
              />

              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-black font-bold py-3 px-4 rounded flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Spracúvam...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Spustiť úlohu
                  </>
                )}
              </button>

            </form>
          </section>

          <section className="bg-zinc-950 border border-emerald-950 rounded-lg p-5">

            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Multi-Agent Registry
            </h2>

            <div className="space-y-3 text-xs">
              {AGENTS.map(agent => (
                <div
                  key={agent}
                  className="flex justify-between border-b border-zinc-900 pb-2 gap-2"
                >
                  <span className="text-zinc-400 break-all">
                    {agent}
                  </span>

                  <span className="text-yellow-400 shrink-0">
                    Neoverený
                  </span>
                </div>
              ))}
            </div>

          </section>
        </div>

        <section className="lg:col-span-2 bg-zinc-950 border border-emerald-950 rounded-lg p-5 flex flex-col">

          <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-3">
            <span className="text-xs uppercase text-zinc-400 tracking-wider">
              Live Multi-Agent Telemetria
            </span>

            <span className="text-xs text-zinc-600">
              STDOUT / AGENT LOG
            </span>
          </div>

          <div className="flex-1 bg-black border border-zinc-900 rounded p-4 overflow-y-auto space-y-3 text-xs max-h-[550px]">

            {logs.map((log, index) => (
              <div
                key={index}
                className={`leading-relaxed whitespace-pre-wrap break-words ${
                  log.startsWith(">")
                    ? "text-yellow-400 font-bold"
                    : log.startsWith("✔")
                    ? "text-white font-semibold bg-emerald-950/50 p-2 rounded"
                    : log.startsWith("✖")
                    ? "text-red-400 font-bold bg-red-950/30 p-2 rounded"
                    : log.startsWith("[Krok")
                    ? "text-cyan-400 font-semibold"
                    : log.startsWith("->")
                    ? "text-purple-400"
                    : log.startsWith("<-")
                    ? "text-zinc-400"
                    : log.startsWith("[WARNING]")
                    ? "text-yellow-400"
                    : "text-emerald-500"
                }`}
              >
                {log}
              </div>
            ))}

          </div>
        </section>

      </div>
    </div>
  );
}