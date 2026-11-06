"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Terminal,
  Shield,
  Disc,
  Play,
  Volume2,
  Mic,
  Sliders,
  Sparkles,
  Search,
  CheckCircle2,
  Download,
  Trash2,
  ChevronRight,
  Radio,
  Zap,
  Flame,
  Award
} from "lucide-react";

type AgentStep = {
  stepNumber?: number;
  thought?: string;
  action?: {
    tool?: string;
    input?: unknown;
  };
  observation?: unknown;
};

type AgentResponse = {
  status?: string;
  error?: string;
  data?: {
    receiptId?: string;
    timestamp?: string;
    agentId?: string;
    steps?: AgentStep[];
    finalAnswer?: string;
  };
};

type AgentItem = {
  id: string;
  name: string;
  cluster: string;
  streetRole: string;
  role: string;
  toolsCount: number;
};

type SkillItem = {
  id: string;
  name: string;
  description: string;
  clusters: string[];
};

type LogEntry = {
  id: string;
  timestamp: string;
  type: "system" | "prompt" | "step" | "tool" | "result" | "success" | "error" | "receipt";
  text: string;
  receiptId?: string;
};

// 46 Crew members in the Street Ecosystem
const CREW_AGENTS: AgentItem[] = [
  { id: "orchestrator", name: "Trinity Omni-Core", cluster: "Riadenie", streetRole: "HEAD PRODUCER & EXECUTIVE MC", role: "Koordinuj celý tím, mixuj overené výsledky a drž hlavný master flow.", toolsCount: 179 },
  { id: "gemini-gem", name: "Gemini pre Trinity", cluster: "Riadenie", streetRole: "FREESTYLE CO-PRODUCER", role: "Vysokorýchlostný AI model s kontextom Trinity a automatickým fallbackom.", toolsCount: 142 },
  { id: "planner", name: "Plánovač", cluster: "Riadenie", streetRole: "TRACK ARRANGER", role: "Rozlož zadanie na vykonateľné beaty s podmienkami úspechu.", toolsCount: 142 },
  { id: "project-manager", name: "Projektový manažér", cluster: "Riadenie", streetRole: "LABEL MANAGER", role: "Spravuj rozsah projektu, míľniky, závislosti a termíny releasov.", toolsCount: 142 },
  { id: "requirements", name: "Analytik požiadaviek", cluster: "Riadenie", streetRole: "RIDER ANALYST", role: "Spresni požiadavky a zostav nepriestrelné akceptačné kritériá.", toolsCount: 142 },
  { id: "risk-manager", name: "Analytik rizík", cluster: "Riadenie", streetRole: "STREET RISK EVALUATOR", role: "Identifikuj pasce, riziká a priprav únikové scenáre.", toolsCount: 142 },
  { id: "architect", name: "Architekt", cluster: "Vývoj", streetRole: "BEAT ARCHITECT", role: "Navrhuj modulárne systémy a konkrétne rozhrania.", toolsCount: 143 },
  { id: "frontend", name: "Frontend vývojár", cluster: "Vývoj", streetRole: "VISUAL FLOW CRAFTSMAN", role: "Vytváraj prístupné responzívne HTML, CSS a JavaScript rozhrania.", toolsCount: 137 },
  { id: "backend", name: "Backend vývojár", cluster: "Vývoj", streetRole: "BASSLINE & ENGINE CODER", role: "Implementuj API, validáciu vstupov a bezpečné spracovanie chýb.", toolsCount: 146 },
  { id: "python", name: "Python vývojár", cluster: "Vývoj", streetRole: "PYTHON BEATSMITH", role: "Píš spustiteľný Python s jasnými závislosťami a testami.", toolsCount: 137 },
  { id: "code-reviewer", name: "Kontrolór kódu", cluster: "Vývoj", streetRole: "FLOW CRITIC", role: "Hľadaj konkrétne chyby v dodanom kóde a navrhni presné opravy.", toolsCount: 137 },
  { id: "cloudflare", name: "Cloudflare inžinier", cluster: "Cloud a prevádzka", streetRole: "SOUNDSYSTEM COMMANDER", role: "Analyzuj Workers, bindingy, D1, R2 a globálnu edge infraštruktúru.", toolsCount: 155 },
  { id: "release", name: "Release inžinier", cluster: "Cloud a prevádzka", streetRole: "DROP MASTER", role: "Priprav build, overenie, nasadenie a návrat verzie.", toolsCount: 147 },
  { id: "sre", name: "Prevádzkový inžinier", cluster: "Cloud a prevádzka", streetRole: "GIG SOUND TECH", role: "Vyhodnoť dostupnosť služieb podľa skutočných kontrol.", toolsCount: 144 },
  { id: "performance", name: "Analytik výkonu", cluster: "Cloud a prevádzka", streetRole: "BPM ACCELERATOR", role: "Nájdi úzke miesta a navrhni merateľné optimalizácie rýchlosti.", toolsCount: 144 },
  { id: "cost", name: "Analytik nákladov", cluster: "Cloud a prevádzka", streetRole: "BUDGET KEEPER", role: "Odhadni spotrebu tokenov a infraštruktúry s presným výpočtom.", toolsCount: 144 },
  { id: "database", name: "Databázový inžinier", cluster: "Dáta a pamäť", streetRole: "CRATE DIGGER // SQL", role: "Navrhuj SQL schémy a nedeštruktívne migrácie.", toolsCount: 128 },
  { id: "memory-curator", name: "Správca pamäte", cluster: "Dáta a pamäť", streetRole: "SAMPLE ARCHIVIST", role: "Organizuj dostupné záznamy; rozlišuj zdroje a overené fakty.", toolsCount: 128 },
  { id: "knowledge", name: "Správca znalostí", cluster: "Dáta a pamäť", streetRole: "OLD-SCHOOL ENCYCLOPEDIST", role: "Prepájaj znalosti a zachovávaj ich pôvod v D1 úložisku.", toolsCount: 128 },
  { id: "data-analyst", name: "Dátový analytik", cluster: "Dáta a pamäť", streetRole: "TELEMETRY HACKER", role: "Analyzuj dodané dáta a vysvetli limity výpočtov.", toolsCount: 128 },
  { id: "integration", name: "Integračný inžinier", cluster: "Dáta a pamäť", streetRole: "PATCHBAY CONNECTOR", role: "Navrhuj a overuj kontrakty existujúcich konektorov.", toolsCount: 128 },
  { id: "researcher", name: "Výskumník", cluster: "Výskum", streetRole: "UNDERGROUND DIGGER", role: "Vyhľadávaj overené zdroje a oddeľ fakty od šumov.", toolsCount: 129 },
  { id: "fact-checker", name: "Overovateľ faktov", cluster: "Výskum", streetRole: "BEEF ARBITER & FACT CHECKER", role: "Kontroluj tvrdenia podľa doložených zdrojov.", toolsCount: 129 },
  { id: "technical-research", name: "Technický výskumník", cluster: "Výskum", streetRole: "HARDWARE & CODE SCOUT", role: "Vyhodnocuj technickú dokumentáciu a možnosti implementácie.", toolsCount: 129 },
  { id: "market-research", name: "Trhový analytik", cluster: "Výskum", streetRole: "STREET ECONOMIST", role: "Analyzuj trendy z aktuálnych zdrojov, komodity a portfólio.", toolsCount: 140 },
  { id: "document-analyst", name: "Analytik dokumentov", cluster: "Výskum", streetRole: "MANUSCRIPT ANALYST", role: "Spracuj text, zhrň ho a odhaľ slabé miesta.", toolsCount: 129 },
  { id: "business-development", name: "Obchodný koordinátor", cluster: "Obchod a rast", streetRole: "HUSTLE GENERAL", role: "Dôkazmi podložený biznis, predajné ponuky a platobné prepojenia.", toolsCount: 140 },
  { id: "lead-research", name: "Výskumník zákazníkov", cluster: "Obchod a rast", streetRole: "FANBASE SCOUT", role: "Hľadaj overené obchodné príležitosti a zachytávaj trhové signály.", toolsCount: 137 },
  { id: "offer-strategist", name: "Tvorca ponúk", cluster: "Obchod a rast", streetRole: "DEAL MAKER", role: "Spoj problém zákazníka s konkrétnou cenou a hodnotou.", toolsCount: 137 },
  { id: "web-sales", name: "Predaj webových služieb", cluster: "Obchod a rast", streetRole: "DIGITAL MERCH AGENT", role: "Priprav návrhy webov, domén a digitálnych riešení.", toolsCount: 137 },
  { id: "growth-analyst", name: "Analytik rastu", cluster: "Obchod a rast", streetRole: "CHARTS & VIRAL TRACKER", role: "Meraj konverzie, dopyty a výkonnosť kampaní.", toolsCount: 140 },
  { id: "ux", name: "UX dizajnér", cluster: "Tvorba", streetRole: "STREET ERGONOMICS", role: "Navrhuj jednoduché a intuitívne používateľské flows.", toolsCount: 127 },
  { id: "ui", name: "UI dizajnér", cluster: "Tvorba", streetRole: "GRAFFITI & STYLING WRITER", role: "Navrhuj drzé, moderné a nezameniteľné vizuálne prostredie.", toolsCount: 128 },
  { id: "writer", name: "Autor textov", cluster: "Tvorba", streetRole: "GHOSTWRITER & LYRICIST", role: "Vytváraj ostré, použiteľné slovenské texty a popisy.", toolsCount: 128 },
  { id: "editor", name: "Redaktor", cluster: "Tvorba", streetRole: "FLOW EDITOR", role: "Upravuj texty na jasnosť, údernosť a presnosť.", toolsCount: 127 },
  { id: "translator", name: "Prekladateľ", cluster: "Tvorba", streetRole: "STREET INTERPRETER", role: "Prekladaj s dôrazom na autentický slang a presnú terminológiu.", toolsCount: 127 },
  { id: "qa", name: "QA inžinier", cluster: "Kvalita a bezpečnosť", streetRole: "CHIEF BOUNCER // QA", role: "Skontroluj výstupy tímu a zachovaj 100% nepriestrelné testy.", toolsCount: 128 },
  { id: "test-designer", name: "Testovací inžinier", cluster: "Kvalita a bezpečnosť", streetRole: "STRESS TESTER", role: "Píš hraničné testovacie prípady a rozbíjaj slabé miesta.", toolsCount: 128 },
  { id: "security", name: "Bezpečnostný analytik", cluster: "Kvalita a bezpečnosť", streetRole: "SOVEREIGN ENFORCER", role: "Chráň Sovereign Lock, secrets v .env a imunitu systému.", toolsCount: 128 },
  { id: "privacy", name: "Správca súkromia", cluster: "Kvalita a bezpečnosť", streetRole: "STEALTH GUARD", role: "Minimalizuj dáta a chráň identitu Basterixa.", toolsCount: 128 },
  { id: "accessibility", name: "Špecialista prístupnosti", cluster: "Kvalita a bezpečnosť", streetRole: "ALL-HOODS ACCESS", role: "Kontroluj ovládanie klávesnicou a dostupnosť.", toolsCount: 128 },
  { id: "workflow", name: "Workflow inžinier", cluster: "Podpora a automatizácia", streetRole: "SEQUENCER & SAMPLER", role: "Navrhuj spoľahlivé automatické slučky a návrat po chybe.", toolsCount: 128 },
  { id: "support", name: "Technická podpora", cluster: "Podpora a automatizácia", streetRole: "ROAD CREW TECH", role: "Diagnostikuj problém z dôkazov a vyrieš ho hneď.", toolsCount: 128 },
  { id: "incident", name: "Koordinátor incidentov", cluster: "Podpora a automatizácia", streetRole: "EMERGENCY DJ", role: "Rýchly zásah pri výpadkoch a obnova systému.", toolsCount: 128 },
  { id: "documentation", name: "Dokumentarista", cluster: "Podpora a automatizácia", streetRole: "LABEL CHRONICLER", role: "Zaznamenávaj skutočný priebeh a históriu relácií.", toolsCount: 128 },
  { id: "reporter", name: "Spravodajca výsledkov", cluster: "Podpora a automatizácia", streetRole: "MIC HOST & TELEMETRY", role: "Priprav prehľad vykonaného, dôkazy a telemetriu.", toolsCount: 128 }
];

const CLUSTER_STICKERS: Record<string, string> = {
  "Riadenie": "sticker-lime",
  "Vývoj": "sticker-cyan",
  "Cloud a prevádzka": "sticker-orange",
  "Dáta a pamäť": "sticker-purple",
  "Výskum": "sticker-cyan",
  "Obchod a rast": "sticker-lime",
  "Tvorba": "sticker-orange",
  "Kvalita a bezpečnosť": "sticker-purple",
  "Podpora a automatizácia": "sticker-lime"
};

const MPC_QUICK_DROPS = [
  { pad: "PAD 01", title: "🔥 FULL SYSTEM CIPHER", prompt: "Spusti komplexnú diagnostiku Trinity Omni-Core, over stav všetkých 46 agentov a skontroluj pripojenie k D1 a Cloudflare." },
  { pad: "PAD 02", title: "🛡️ TRUTHGUARD & ROOT LOCK", prompt: "Vykonaj bezpečnostný audit Sovereign Locku, over ochranu kľúčov v .env a súlad s TruthGuard Ústavou." },
  { pad: "PAD 03", title: "🔊 CLOUDFLARE SOUNDSYSTEM", prompt: "Otestuj routing na doménach auru.space a auru.dev a over pripravenosť Workerov." },
  { pad: "PAD 04", title: "💽 CRATE SAMPLE SNAPSHOT", prompt: "Vytvor snapshot spoločnej pamäte agentov a zosynchronizuj nedávne zápisy do Sovereign Ledger." }
];

export default function StreetTrinityDashboard() {
  const [activeTab, setActiveTab] = useState<"cipher" | "crew" | "samples" | "drops">("cipher");
  const [selectedAgentId, setSelectedAgentId] = useState("orchestrator");
  const [crewSearch, setCrewSearch] = useState("");
  const [clusterFilter, setClusterFilter] = useState("VŠETKY ODDIELKY");
  const [sampleSearch, setSampleSearch] = useState("");

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [skillsTotal, setSkillsTotal] = useState<number>(152);
  const [skillsList, setSkillsList] = useState<SkillItem[]>([]);
  const [receipts, setReceipts] = useState<Array<{ id: string; agent: string; time: string; summary: string }>>([
    { id: "DROP-ROOT-001", agent: "Trinity Omni-Core", time: "NOW", summary: "TRINITY OMNI-CORE 11.1 STREET SYSTEM ACTIVE PRE BASTERIXA." }
  ]);

  const [logs, setLogs] = useState<LogEntry[]>([
    { id: "1", timestamp: "08:55:00", type: "system", text: "/// TRINITY OMNI-CORE // BASTERIX LABS STREET CONSOLE ONLINE ///" },
    { id: "2", timestamp: "08:55:01", type: "system", text: "ROOT OWNER IDENT: Basterix (saboivan2008@gmail.com) [SOVEREIGN CHARTER LOCKED]" },
    { id: "3", timestamp: "08:55:02", type: "system", text: "CREW ROSTER: 46 AGENTOV V 9 ODDIEĽOCH // 152 SAMPLOV PRIPRAVENÝCH" },
    { id: "4", timestamp: "08:55:03", type: "system", text: "MIC ON: OpenAI GPT-4o + Cloudflare Edge Workers [LIVE SYNERGY]" }
  ]);

  const appendLog = (type: LogEntry["type"], text: string, receiptId?: string) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString("sk-SK"),
      type,
      text,
      receiptId
    };
    setLogs(prev => [...prev, entry]);
  };

  useEffect(() => {
    async function loadSkillsAndAgents() {
      try {
        const res = await fetch("/api/skills");
        if (res.ok) {
          const data = await res.json();
          if (data.total) setSkillsTotal(data.total);
          if (data.skills && Array.isArray(data.skills)) {
            setSkillsList(data.skills);
          }
        }
      } catch {
        // Fallback smooth
      }
    }
    void loadSkillsAndAgents();
  }, []);

  const activeAgent = useMemo(() => {
    return CREW_AGENTS.find(a => a.id === selectedAgentId) || CREW_AGENTS[0];
  }, [selectedAgentId]);

  const filteredCrew = useMemo(() => {
    return CREW_AGENTS.filter(agent => {
      const matchSearch = agent.name.toLowerCase().includes(crewSearch.toLowerCase()) ||
                          agent.id.toLowerCase().includes(crewSearch.toLowerCase()) ||
                          agent.streetRole.toLowerCase().includes(crewSearch.toLowerCase()) ||
                          agent.role.toLowerCase().includes(crewSearch.toLowerCase());
      const matchCluster = clusterFilter === "VŠETKY ODDIELKY" || agent.cluster.toUpperCase() === clusterFilter;
      return matchSearch && matchCluster;
    });
  }, [crewSearch, clusterFilter]);

  const filteredSkills = useMemo(() => {
    return skillsList.filter(skill => {
      return skill.name.toLowerCase().includes(sampleSearch.toLowerCase()) ||
             skill.description.toLowerCase().includes(sampleSearch.toLowerCase()) ||
             skill.id.toLowerCase().includes(sampleSearch.toLowerCase());
    });
  }, [skillsList, sampleSearch]);

  const handleRunTask = async (taskText?: string) => {
    const currentPrompt = (taskText || prompt).trim();
    if (!currentPrompt || isLoading) return;

    if (!taskText) setPrompt("");
    setIsLoading(true);

    appendLog("prompt", `[MC: ${activeAgent.name.toUpperCase()}] >> "${currentPrompt}"`);
    appendLog("system", `[DROP ENGINE] Spúšťam flow cez [${activeAgent.id}]...`);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: currentPrompt,
          agentId: activeAgent.id
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: AgentResponse = await res.json();

      if (data.status === "SUCCESS" && data.data) {
        const steps = data.data.steps || [];

        for (const step of steps) {
          if (step.thought) {
            appendLog("step", `[FLOW ${step.stepNumber ?? 1}] ${step.thought}`);
          }
          if (step.action?.tool) {
            appendLog("tool", `-> SAMPLE/TOOL: ${step.action.tool}`);
          }
          if (step.observation) {
            appendLog("result", `<- OUTCOME: ${typeof step.observation === "object" ? JSON.stringify(step.observation) : String(step.observation)}`);
          }
        }

        if (data.data.finalAnswer) {
          appendLog("success", `🔥 MASTER VÝSTUP OD [${activeAgent.name.toUpperCase()}]:\n${data.data.finalAnswer}`);
        }

        if (data.data.receiptId) {
          appendLog("receipt", `📜 STREET RECEIPT: ${data.data.receiptId}`, data.data.receiptId);
          setReceipts(prev => [
            {
              id: data.data?.receiptId || "DROP-RCPT",
              agent: activeAgent.name,
              time: new Date().toLocaleTimeString("sk-SK"),
              summary: currentPrompt.length > 55 ? currentPrompt.substring(0, 52) + "..." : currentPrompt
            },
            ...prev
          ]);
        }
      } else {
        appendLog("error", `✖ BEEF/ERROR: ${data.error || "Zlyhanie exekúcie"}`);
      }
    } catch (err: any) {
      appendLog("error", `✖ SOUNDSYSTEM DROPOUT: ${err?.message || "Server neodpovedá"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLogs = () => {
    setLogs([
      { id: "cleared", timestamp: new Date().toLocaleTimeString("sk-SK"), type: "system", text: "/// MIXTAPE LOG VYČISTENÝ OPERÁTOROM ///" }
    ]);
  };

  const handleExportLogs = () => {
    const textContent = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`).join("\n");
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trinity-street-mixtape-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="street-container">
      {/* Top Street Warning Tape */}
      <div className="hazard-tape">
        ⚠ BASTERIX UNDERGROUND RECORDING // 46 CREW AGENTS // 152 SOUND SAMPLES // RAW TELEMETRY // SOVEREIGN ENGINE ⚠
      </div>

      {/* Main Street Header */}
      <header className="concrete-panel p-5 flex flex-wrap items-center justify-between gap-5 border-2 border-white/20">
        <div className="flex items-center gap-5">
          {/* Parental Advisory Badge */}
          <div className="parental-badge">
            <div className="text-[11px] font-black tracking-widest border-b border-white pb-0.5">PARENTAL</div>
            <div className="text-xl font-black tracking-wider leading-none my-1">ADVISORY</div>
            <div className="text-[9px] tracking-widest">EXPLICIT AI SOVEREIGNTY</div>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-black font-street tracking-wider text-white">
                TRINITY <span className="text-[#d4ff00]">//</span> OMNI-CORE
              </h1>
              <span className="street-sticker sticker-lime text-xs">v11.1 STREET ED.</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-graffiti text-sm text-[#ff3c00]">Basterix Master Production</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-xs text-slate-400">saboivan2008@gmail.com</span>
            </div>
          </div>
        </div>

        {/* Street Badges & Live Equalizer */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-black/60 p-2.5 px-3 border border-white/10 rounded">
            <div className="eq-container">
              <span className="eq-bar"></span>
              <span className="eq-bar"></span>
              <span className="eq-bar"></span>
              <span className="eq-bar"></span>
              <span className="eq-bar"></span>
              <span className="eq-bar"></span>
              <span className="eq-bar"></span>
              <span className="eq-bar"></span>
            </div>
            <span className="font-street text-sm tracking-widest text-[#d4ff00]">LIVE VU</span>
          </div>

          <div className="street-sticker sticker-orange">
            <Shield className="w-3.5 h-3.5" />
            <span>ROOT LOCKED</span>
          </div>

          <div className="street-sticker sticker-lime">
            <Disc className="w-3.5 h-3.5" />
            <span>46 CREW MEMBERS</span>
          </div>

          <div className="street-sticker sticker-cyan">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{skillsTotal} SAMPLES</span>
          </div>
        </div>
      </header>

      {/* Street Navigation Bar */}
      <nav className="flex flex-wrap items-center justify-between gap-3 bg-black/80 p-2 border-2 border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("cipher")}
            className={`nav-street-tab ${activeTab === "cipher" ? "active" : ""}`}
          >
            <Mic className="w-4 h-4" />
            <span>[01] Cipher & Flow (Konzola)</span>
          </button>

          <button
            onClick={() => setActiveTab("crew")}
            className={`nav-street-tab ${activeTab === "crew" ? "active" : ""}`}
          >
            <Flame className="w-4 h-4" />
            <span>[02] 46-Hlavová Crew (Agenti)</span>
          </button>

          <button
            onClick={() => setActiveTab("samples")}
            className={`nav-street-tab ${activeTab === "samples" ? "active" : ""}`}
          >
            <Disc className="w-4 h-4" />
            <span>[03] Crate Samples ({skillsTotal} Skilly)</span>
          </button>

          <button
            onClick={() => setActiveTab("drops")}
            className={`nav-street-tab ${activeTab === "drops" ? "active" : ""}`}
          >
            <Award className="w-4 h-4" />
            <span>[04] Street Drops & Receipts ({receipts.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 bg-[#12141d] border border-white/10">
          <span className="text-[11px] font-street tracking-wider text-slate-400">ACTIVE MC:</span>
          <span className="font-street text-base text-[#d4ff00]">{activeAgent.name.toUpperCase()}</span>
          <span className="text-[10px] font-mono text-[#00f0ff]">[{activeAgent.cluster}]</span>
        </div>
      </nav>

      {/* TAB 01: CIPHER & FLOW (CONSOLE) */}
      {activeTab === "cipher" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Left Column: MPC Deck & Command Center */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Active MC / Producer Header */}
            <div className="concrete-panel p-4 flex items-center justify-between gap-3 border-l-4 border-l-[#d4ff00]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-black border-2 border-[#d4ff00] flex items-center justify-center font-street text-2xl text-[#d4ff00] font-black">
                  {activeAgent.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-street text-xl text-white tracking-wide">{activeAgent.name.toUpperCase()}</h3>
                    <span className="text-[10px] px-2 py-0.5 bg-[#d4ff00] text-black font-black uppercase font-street">
                      {activeAgent.cluster}
                    </span>
                  </div>
                  <p className="text-xs text-[#00f0ff] font-mono mt-0.5">{activeAgent.streetRole}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("crew")}
                className="font-street text-sm text-[#d4ff00] hover:underline flex items-center gap-1 shrink-0"
              >
                VYMEŇ AGENTA →
              </button>
            </div>

            {/* Prompt Box */}
            <section className="concrete-panel p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-street text-lg text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#d4ff00]" />
                  ZADAJ FLOW / ÚLOHU PRE CREW
                </span>
                <span className="font-mono text-xs text-slate-400">
                  Target: <b className="text-[#00f0ff]">{activeAgent.id}</b>
                </span>
              </div>

              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleRunTask();
                  }
                }}
                placeholder={`Nahoď rým alebo príkaz pre [${activeAgent.name.toUpperCase()}]... (Enter odpáli drop)`}
                rows={5}
                className="w-full bg-black border-2 border-white/20 p-4 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#d4ff00] resize-none"
              />

              <button
                onClick={() => handleRunTask()}
                disabled={isLoading || !prompt.trim()}
                className="btn-street-drop w-full"
              >
                {isLoading ? (
                  <>
                    <Disc className="w-5 h-5 animate-spin text-black" />
                    <span>SPRACOVÁVAM STREET FLOW...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current text-black" />
                    <span>⚡ DROP THE BEAT (SPUSTIŤ)</span>
                  </>
                )}
              </button>
            </section>

            {/* MPC Beat Pads (Quick Drops) */}
            <section className="concrete-panel p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-street text-base text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#ff3c00]" />
                  MPC SAMPLER QUICK-DROPS
                </span>
                <span className="font-mono text-[11px] text-slate-400">4 BEAT TRIGGER PADS</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MPC_QUICK_DROPS.map(drop => (
                  <button
                    key={drop.pad}
                    onClick={() => {
                      setPrompt(drop.prompt);
                      void handleRunTask(drop.prompt);
                    }}
                    disabled={isLoading}
                    className="mpc-pad group"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-mono text-[10px] text-[#d4ff00] font-black">{drop.pad}</span>
                      <span className="w-2 h-2 rounded-full bg-[#3a4259] group-hover:bg-[#d4ff00] transition-colors"></span>
                    </div>
                    <div className="font-street text-base text-white group-hover:text-[#d4ff00] leading-snug">
                      {drop.title}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono line-clamp-1 mt-1">
                      {drop.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Live Boombox Cipher Telemetry */}
          <section className="lg:col-span-7 concrete-panel p-5 flex flex-col gap-4 border-orange min-h-[580px]">
            <div className="flex flex-wrap items-center justify-between border-b-2 border-white/10 pb-3 gap-2">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[#ff3c00] animate-pulse"></span>
                <span className="font-street text-xl text-white tracking-wider">
                  LIVE BOOMBOX CIPHER & TELEMETRIA
                </span>
                <span className="street-sticker sticker-orange text-[11px]">
                  {logs.length} BEAT EVENTS
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportLogs}
                  title="Stiahnuť mixtape log"
                  className="p-2 bg-black border border-white/20 hover:border-[#d4ff00] text-slate-300 hover:text-[#d4ff00] transition-colors"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClearLogs}
                  title="Vymazať pásku"
                  className="p-2 bg-black border border-white/20 hover:border-[#ff3c00] text-slate-300 hover:text-[#ff3c00] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Terminal Feed */}
            <div className="flex-1 bg-black/90 border-2 border-white/10 p-4 font-mono text-xs overflow-y-auto space-y-3.5 max-h-[580px]">
              {logs.map(log => {
                let badgeClass = "bg-slate-800 text-slate-300 border-slate-700";
                let badge = "SYS";
                let textClass = "text-slate-300";

                if (log.type === "prompt") {
                  badge = "MC INPUT";
                  badgeClass = "bg-[#d4ff00] text-black font-black border-[#d4ff00]";
                  textClass = "text-[#d4ff00] font-bold";
                } else if (log.type === "step") {
                  badge = "BEAT";
                  badgeClass = "bg-[#00f0ff] text-black font-black border-[#00f0ff]";
                  textClass = "text-cyan-300";
                } else if (log.type === "tool") {
                  badge = "SAMPLE";
                  badgeClass = "bg-purple-900 text-purple-200 border-purple-600";
                  textClass = "text-purple-300";
                } else if (log.type === "result") {
                  badge = "OUTCOME";
                  badgeClass = "bg-zinc-900 text-slate-400 border-zinc-700";
                  textClass = "text-slate-400";
                } else if (log.type === "success") {
                  badge = "MASTER HIT";
                  badgeClass = "bg-[#00ff66] text-black font-black border-[#00ff66]";
                  textClass = "text-white bg-[#00ff66]/10 p-3 border-l-4 border-[#00ff66] font-semibold";
                } else if (log.type === "receipt") {
                  badge = "RECEIPT";
                  badgeClass = "bg-[#facc15] text-black font-black border-[#facc15]";
                  textClass = "text-yellow-300 bg-yellow-950/40 p-2.5 border border-yellow-500/50 font-bold";
                } else if (log.type === "error") {
                  badge = "BEEF ERROR";
                  badgeClass = "bg-[#ff3c00] text-white font-black border-[#ff3c00]";
                  textClass = "text-red-300 bg-red-950/40 p-3 border-l-4 border-red-600 font-bold";
                }

                return (
                  <div key={log.id} className="flex items-start gap-2.5 leading-relaxed break-words">
                    <span className="text-[10px] text-slate-500 shrink-0 select-none pt-0.5">
                      {log.timestamp}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 font-street tracking-wider uppercase shrink-0 border ${badgeClass}`}>
                      {badge}
                    </span>
                    <div className={`flex-1 whitespace-pre-wrap ${textClass}`}>
                      {log.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 02: 46-HLAVOVÁ CREW */}
      {activeTab === "crew" && (
        <section className="flex flex-col gap-5">
          {/* Street Filter Deck */}
          <div className="concrete-panel p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-black border border-white/20 px-3 py-1.5">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={crewSearch}
                onChange={e => setCrewSearch(e.target.value)}
                placeholder="Hľadať v 46-člennej crew podľa mena alebo role..."
                className="w-full bg-transparent font-mono text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {["VŠETKY ODDIELKY", "RIADENIE", "VÝVOJ", "CLOUD A PREVÁDZKA", "DÁTA A PAMÄŤ", "VÝSKUM", "OBCHOD A RAST", "TVORBA", "KVALITA A BEZPEČNOSŤ", "PODPORA A AUTOMATIZÁCIA"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setClusterFilter(cat)}
                  className={`px-3 py-1 font-street text-sm tracking-wider uppercase transition-all ${
                    clusterFilter === cat
                      ? "bg-[#d4ff00] text-black font-black shadow-md shadow-[#d4ff00]/40"
                      : "bg-black/60 text-slate-400 hover:text-white border border-white/10"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Crew Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCrew.map(agent => {
              const isSelected = agent.id === selectedAgentId;
              const stickerClass = CLUSTER_STICKERS[agent.cluster] || "sticker-lime";

              return (
                <div
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgentId(agent.id);
                    setActiveTab("cipher");
                  }}
                  className={`concrete-panel p-4 cursor-pointer transition-all ${
                    isSelected ? "border-2 border-[#d4ff00] bg-[#1a2114]" : "hover:border-[#00f0ff]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-street text-xl text-white tracking-wide flex items-center gap-2">
                        {agent.name.toUpperCase()}
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[#d4ff00] inline" />}
                      </h4>
                      <div className="text-[11px] font-mono text-[#00f0ff] font-bold">
                        {agent.streetRole}
                      </div>
                    </div>

                    <span className={`street-sticker ${stickerClass} text-[10px]`}>
                      {agent.cluster}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-mono mb-3 line-clamp-2 leading-relaxed">
                    {agent.role}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-mono border-t border-white/10 pt-2 text-slate-500">
                    <span>SAMPLES / TOOLS: <b className="text-white">{agent.toolsCount}</b></span>
                    <span className="font-street text-sm text-[#d4ff00] hover:underline flex items-center gap-1 font-bold">
                      VYBRAŤ NA MIC →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 03: CRATE SAMPLES & SKILLS */}
      {activeTab === "samples" && (
        <section className="concrete-panel p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-white/10 pb-4">
            <div>
              <h2 className="font-street text-2xl text-white flex items-center gap-2">
                <Disc className="w-6 h-6 text-[#d4ff00]" />
                CRATE ARCHIVE // 152 SKILLOV & SAMPLES
              </h2>
              <p className="font-mono text-xs text-slate-400">
                Oficiálna vzorkovňa schopností, nástrojov a prepojení pre všetkých 46 agentov.
              </p>
            </div>

            <div className="flex items-center gap-2 max-w-sm w-full bg-black border border-white/20 px-3 py-1.5">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={sampleSearch}
                onChange={e => setSampleSearch(e.target.value)}
                placeholder="Filtrovať v 152 samploch..."
                className="w-full bg-transparent font-mono text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredSkills.length > 0 ? (
              filteredSkills.map(skill => (
                <div key={skill.id} className="p-3.5 bg-black/60 border border-white/10 hover:border-[#00f0ff] transition-all flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-street text-lg text-white tracking-wide">{skill.name}</h4>
                      <span className="font-mono text-[10px] text-[#d4ff00]">{skill.id}</span>
                    </div>
                    <p className="font-mono text-xs text-slate-400 leading-relaxed">{skill.description}</p>
                  </div>
                  {skill.clusters && skill.clusters.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {skill.clusters.map(c => (
                        <span key={c} className="text-[9px] font-mono px-1.5 py-0.5 bg-[#171a25] text-slate-300 border border-slate-700">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center font-mono text-slate-500 text-xs">
                Archív samplov je aktívny ({skillsTotal} skillov k dispozícii).
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 04: STREET DROPS & RECEIPTS */}
      {activeTab === "drops" && (
        <section className="concrete-panel p-5 flex flex-col gap-5">
          <div className="border-b-2 border-white/10 pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-street text-2xl text-white flex items-center gap-2">
                <Award className="w-6 h-6 text-[#facc15]" />
                STREET DROPS & TRUTHGUARD RECEIPTS
              </h2>
              <p className="font-mono text-xs text-slate-400">
                ZÁKON ULICE & ÚSTAVY: Žiadne reči bez dôkazov (NO RECEIPT = NO SUCCESS).
              </p>
            </div>

            <div className="street-sticker sticker-lime">
              SOVEREIGN OWNER: BASTERIX
            </div>
          </div>

          <div className="space-y-3">
            {receipts.map(r => (
              <div key={r.id} className="p-4 bg-black/80 border-2 border-white/10 flex flex-wrap items-center justify-between gap-3 hover:border-[#d4ff00] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#d4ff00]/10 border-2 border-[#d4ff00] flex items-center justify-center text-[#d4ff00]">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#facc15]">{r.id}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-[#00ff66]/20 text-[#00ff66] font-mono font-bold border border-[#00ff66]/40">
                        VERIFIED_STREET_DROP
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-300 mt-1">{r.summary}</p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs text-slate-400">
                  <div>MC / AGENT: <span className="text-white font-bold">{r.agent}</span></div>
                  <div>ČAS: <span className="text-[#00f0ff]">{r.time}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
