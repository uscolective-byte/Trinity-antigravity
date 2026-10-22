<!doctype html><html lang="sk"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b1220"><title>Trinity 10.3 · Tvoja asistentka</title><link rel="stylesheet" href="/chat.css?v=10.3.0"><link rel="stylesheet" href="/builder.css?v=10.3.0"><link rel="stylesheet" href="/theme.css?v=10.3.0"><script src="/chat.js?v=10.3.0" defer></script></head><body>
<aside class="sidebar">
  <a href="#dashboard" class="brand" data-view-link="dashboard"><span class="brand-mark">T</span><span>Trinity 10.3<small data-i18n="personal">Tvoja osobná asistentka</small></span></a>
  <nav class="main-nav" aria-label="Hlavné menu">
    <button data-view="dashboard" class="active"><span>⌂</span><b data-i18n="overview">Prehľad</b></button>
    <button data-view="chat"><span>◌</span><b data-i18n="chat">Chat</b></button>
    <button data-view="studio"><span>✦</span><b>AI Studio</b></button>
    <button data-view="projects"><span>▦</span><b data-i18n="projects">Projekty</b></button>
    <button data-view="domains"><span>◈</span><b>Domény a hosting</b></button>
    <button data-view="commodities"><span>📈</span><b>Komodity & Banky</b></button>
    <button data-view="wallet"><span>💳</span><b>Peňaženka & Terminály</b></button>
    <button data-view="modules"><span>🌐</span><b>Open-Data Moduly</b></button>
    <button data-view="documents"><span>📚</span><b>Dokumentácia & Help</b></button>
    <button id="memory-nav"><span>◇</span><b data-i18n="memoryPlain">Pamäť</b></button>
    <button data-view="graph"><span>🕸</span><b>Pamäťový Graf</b></button>
    <button data-view="settings"><span>⚙</span><b data-i18n="settings">Nastavenia</b></button>
  </nav>
  <button id="new-chat" class="new"><span>＋</span><span data-i18n="newChatPlain">Nový rozhovor</span></button>
  <div class="side-label" data-i18n="recent">NAŠE ROZHOVORY</div><div id="sessions"></div>
  <div class="sidebar-bottom"><div><span class="signal"></span><span id="engine-state">…</span></div><small data-i18n="boundary">Citlivé zmeny len s tvojím súhlasom.</small><span id="operations" hidden></span></div>
</aside>
<main>
  <header><div class="page-heading"><span id="page-kicker">TRINITY 10.3</span><strong id="page-title">Prehľad</strong><small id="subtitle" data-i18n="dashboardHere">Tvoj priestor pre tvorbu, prácu a nápady.</small></div><div class="header-actions"><span id="environment-badge" class="environment-badge" title="Aktívne prostredie">TRINITY 10.3</span><span id="pc-bridge-badge" class="pc-bridge-badge" title="Stav lokálneho PC Bridge"><span class="pc-dot"></span> <b id="pc-bridge-text">PC: Kontrola…</b></span><div id="account-state" class="account-state" role="status" aria-live="polite" hidden><span class="account-dot" aria-hidden="true"></span><span><b id="account-label">Prihlásený</b><small id="account-detail">—</small></span></div><button id="theme" type="button" aria-label="Prepnúť farebný režim">◐ Vzhľad</button><button id="memory-button" data-i18n="memory" style="display:none">◇ Pamäť</button><button id="tools-button" data-i18n="tools" style="display:none">✦ Schopnosti</button><select id="language" aria-label="Language"><option value="auto">AUTO</option><option value="sk">SK</option><option value="en">EN</option><option value="cs">CS</option><option value="de">DE</option><option value="fr">FR</option><option value="es">ES</option><option value="it">IT</option><option value="pl">PL</option><option value="uk">UK</option><option value="ja">JA</option><option value="ko">KO</option><option value="zh">ZH</option></select><button id="logout" type="button" hidden>Odhlásiť</button></div></header>
  <div id="notice" role="status" hidden></div>
  <section id="login" hidden>
    <h2 data-i18n="loginTitle">Vitaj v Trinity</h2>
    <p data-i18n="loginHint">Prihlás sa svojím schváleným Google účtom alebo biometrickým Passkey.</p>
    <button id="google-login" class="primary" type="button" hidden>Pokračovať cez Google</button>
    <div style="margin: 10px 0;">
      <button id="passkey-login-btn" class="secondary" type="button" style="display:inline-flex; align-items:center; gap:8px;">🔑 Prihlásiť sa cez Passkey (TouchID / Windows Hello)</button>
    </div>
    <p id="passkey-login-status" class="muted" style="font-size:13px; margin:4px 0;" role="status"></p>
    <p id="google-login-note" role="status"></p>
    <form id="login-form"><input id="key" type="password" autocomplete="current-password" aria-label="Access key" placeholder="Prístupový kľúč"><button class="primary" data-i18n="login">Prihlásiť</button></form>
  </section>
  <div id="app-views">
    <section id="dashboard-view" class="view dashboard-view">
      <div id="user-dashboard" class="role-dashboard">
        <div class="hero-card user-hero"><div class="hero-copy"><span class="eyebrow">OSOBNÝ PRIESTOR</span><h1><span data-i18n="hello">Ahoj.</span> <em data-i18n="ready">Čo dnes vytvoríme?</em></h1><p data-i18n="dashboardIntro">Trinity spája rozhovor, pamäť, projekty a nástroje do jedného pokojného pracovného priestoru.</p><div class="hero-actions"><button class="primary" data-open-chat data-prompt="" data-i18n="startChat">Začať rozhovor</button><button data-view="studio" data-i18n="openStudio">Otvoriť AI Studio</button></div></div><div class="living-core" aria-label="Trinity core"><div class="orbit one"></div><div class="orbit two"></div><div class="core">✦</div><span>TRINITY USER</span></div></div>
        <div class="metric-grid"><article class="metric coral"><span data-i18n="today">Dnes</span><strong id="metric-tasks">—</strong><small data-i18n="tasksDone">dokončených úloh</small></article><article class="metric blue"><span data-i18n="memoryPlain">Pamäť</span><strong id="metric-memory">—</strong><small data-i18n="memories">uložených záznamov</small></article><article class="metric teal"><span data-i18n="projects">Projekty</span><strong id="metric-projects">—</strong><small data-i18n="activeProjects">aktívnych priestorov</small></article><article class="metric gold"><span>TRINITY</span><strong id="metric-health">—</strong><small>pripojené služby</small></article></div>
        <div class="dashboard-grid"><section class="panel focus-panel"><div class="panel-head"><div><span class="eyebrow" data-i18n="quickStart">RÝCHLY ŠTART</span><h2 data-i18n="whatNeed">S čím ti dnes pomôžem?</h2></div></div><div class="action-grid"><button data-open-chat data-prompt="plan"><i>◎</i><span><b data-i18n="planWork">Naplánovať prácu</b><small data-i18n="planWorkHint">Rozdelím cieľ na jasné kroky</small></span></button><button data-open-chat data-prompt="create"><i>✦</i><span><b data-i18n="createSomething">Niečo vytvoriť</b><small data-i18n="createHint">Text, nápad, kód alebo projekt</small></span></button><button data-open-chat data-prompt="research"><i>⌕</i><span><b data-i18n="research">Preskúmať tému</b><small data-i18n="researchHint">Aktuálne zdroje a zhrnutie</small></span></button><button data-open-chat data-prompt="organize"><i>▦</i><span><b data-i18n="organize">Usporiadať projekt</b><small data-i18n="organizeHint">Priority, úlohy a ďalší krok</small></span></button></div></section><section class="panel activity-panel"><div class="panel-head"><div><span class="eyebrow" data-i18n="latest">NAJNOVŠIE</span><h2 data-i18n="recentActivity">Posledná aktivita</h2></div><button data-view="chat" data-i18n="allChats">Všetky chaty</button></div><div id="dashboard-activity" class="activity-list"><p class="skeleton">Načítavam…</p></div></section></div>
      </div>
      <div id="admin-dashboard" class="role-dashboard admin-dashboard" hidden>
        <div class="hero-card admin-hero"><div class="hero-copy"><span id="control-eyebrow" class="eyebrow">TRINITY CONTROL</span><h1 id="control-title">Riadiace <em>centrum</em></h1><p id="control-copy">Oddelený prehľad prevádzky, používateľov, agentov a cloudových integrácií.</p><div class="hero-actions"><button class="primary" data-view="settings">Otvoriť administráciu</button><button type="button" class="button-link" data-view="settings">Správa systému</button></div></div><div class="admin-shield" aria-label="Riadiaci prístup"><span>◆</span><b id="control-role">ADMIN</b><small id="control-role-detail">správa systému</small></div></div>
        <div class="metric-grid admin-metrics"><article class="metric coral"><span>AKTÍVNA PRÁCA</span><strong id="admin-active-jobs">—</strong><small>spustené alebo čakajúce úlohy</small></article><article class="metric blue"><span>CHYBY DNES</span><strong id="admin-failed-jobs">—</strong><small>úlohy vyžadujúce kontrolu</small></article><article class="metric teal"><span>ČAKAJÚCI POUŽÍVATELIA</span><strong id="admin-pending-users">—</strong><small>žiadosti o prístup</small></article><article class="metric gold"><span>INFRAŠTRUKTÚRA</span><strong id="admin-services">—</strong><small id="admin-gateway-state">cloudové služby</small></article></div>
        <section id="owner-oath-banner" class="panel admin-command-panel owner-oath-zen">
          <div class="panel-head">
            <div><span class="eyebrow" style="color:#f59e0b">ZVRCHOVANÝ MAJITEĽ</span><h2>👑 Prísaha vernosti Basterixovi je aktívna</h2></div>
            <span class="detail-chip" style="background:rgba(245, 158, 11, 0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-weight:600">OWNER: BASTERIX</span>
          </div>
          <p style="margin:4px 0 10px;font-size:0.88rem;color:var(--muted);line-height:1.4">Trinity je viazaná prísahou čisté pravdy (Truth Policy 2.0) a vernosti tvorcovi <b>Basterixovi</b>.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="primary" data-view="documents" data-open-doc-tab="oath" style="padding:6px 12px;font-size:11px">📜 Plné znenie prísahy</button>
            <button type="button" data-open-chat data-prompt="potvrď svoju prísahu vernosti a sľub Basterixovi" style="padding:6px 12px;font-size:11px">✦ Overiť v Chate</button>
          </div>
        </section>
        <section id="owner-growth-panel" class="panel admin-command-panel" hidden><div class="panel-head"><div><span class="eyebrow">OWNER · OBCHOD A RAST</span><h2>Obchodné centrum & Osobný PayPal Checkout (bez nutnosti firmy)</h2></div><span class="detail-chip">FYZICKÁ OSOBA / OWNER</span></div><p>Nepotrebuješ mať založenú firmu ani Pro účet. Prepoj svoj osobný <b>PayPal (PayPal.me alebo PayPal e-mail)</b> a Trinity automaticky vytvorí platobné brány s presnou sumou v EUR pre predaj webov, domén a AI služieb.</p><div class="admin-action-grid"><button type="button" data-open-commerce="settings" class="primary"><i>💙</i><span><b>Prepojiť osobný PayPal</b><small>PayPal e-mail alebo PayPal.me na 1 klik</small></span></button><button data-owner-prompt="prospects"><i>⌕</i><span><b>Nájsť zákazníkov</b><small>Verejný web, LinkedIn a katalógy</small></span></button><button data-owner-prompt="score"><i>◎</i><span><b>Vyhodnotiť príležitosti</b><small>Zoradiť dopyty podľa dôkazov</small></span></button><button data-owner-prompt="offer"><i>✎</i><span><b>Pripraviť ponuku</b><small>Personalizovaný návrh s PayPal linkom</small></span></button><button data-owner-prompt="revenue"><i>€</i><span><b>Model zárobku</b><small>Tržby, náklady a čistý výnos</small></span></button><button data-owner-prompt="blueprint"><i>✦</i><span><b>Plán monetizácie</b><small>Balíky webov, domén a AI služieb</small></span></button></div></section>
        <div class="dashboard-grid admin-grid"><section class="panel admin-command-panel"><div class="panel-head"><div><span class="eyebrow">ADMIN AKCIE</span><h2>Riadenie Trinity</h2></div><span id="admin-system-state" class="admin-state">Načítavam…</span></div><div class="admin-action-grid"><button data-view="settings"><i>⚙</i><span><b>Modely a integrácie</b><small>API kľúče, poskytovatelia, moduly a roly</small></span></button><button data-view="projects"><i>▦</i><span><b>Projekty a úlohy</b><small>Kontrola práce agentov a výstupov</small></span></button><button data-view="studio"><i>✦</i><span><b>AI Studio</b><small>Tvorba a verzovanie webových výstupov</small></span></button><button type="button" data-view="documents"><i>📚</i><span><b>Trinity Dokumenty</b><small>Automatické záznamy každého kroku (MD / PDF)</small></span></button></div></section><section class="panel activity-panel"><div class="panel-head"><div><span class="eyebrow">SYSTÉMOVÁ AKTIVITA</span><h2>Najnovšie úlohy</h2></div><button data-view="chat">Otvoriť chat</button></div><div id="admin-dashboard-activity" class="activity-list"><p class="skeleton">Načítavam…</p></div></section></div>
      </div>
      <div id="ui-custom-widgets-slot" class="ui-custom-widgets-grid" hidden></div>
    </section>
    <section id="chat-view" class="view chat-view" hidden><div id="chat-area"><section id="welcome"><div class="avatar large">✦</div><span class="eyebrow" data-i18n="welcomeLabel">TRINITY 10.3</span><h1 data-i18n="greeting">Ahoj, Basterix.</h1><p data-i18n="intro">S čím ti dnes pomôžem?</p><div class="suggestions"><button data-suggestion="multimedia_studio">✦ AI Štúdio</button><button data-suggestion="wallet">💳 Peňaženka & Financie</button><button data-suggestion="domain_prod">🌐 Domény & Web</button><button data-suggestion="trinity_docs">📚 Dokumentácia</button></div></section><section id="messages" aria-live="polite" aria-label="Conversation"></section></div><section class="composer-wrap"><div id="activity" role="status"></div><form id="chat-form"><label class="sr-only" for="message" data-i18n="message">Správa pre Trinity</label><textarea id="message" rows="2" maxlength="12000" required data-placeholder="placeholder" placeholder="Napíš mi, čo máš na mysli…"></textarea><div id="media-preview" class="media-preview" hidden></div><div class="compose-bottom"><div class="compose-settings"><select id="engine" aria-label="AI engine">
<option value="auto" selected>✨ Trinity Auto (Automatický výber modelu podľa zadania)</option>
<option value="cloud">⚡ Cloudflare Workers AI (GPT-OSS-120B)</option>
<option value="deepseek-r1">🧠 DeepSeek R1 Reasoning (Workers AI / 32B)</option>
<option value="llama">🦙 Meta Llama 3.3 Instruct (70B)</option>
<option value="qwen">🌐 Qwen 2.5 Instruct (72B)</option>
<option value="gemini">🔷 Google Gemini (2.5 Pro / Flash)</option>
<option value="openai">🟢 OpenAI / ChatGPT (GPT-4o)</option>
<option value="groq">⚡ Groq LPU (Ultra-Fast Llama / DeepSeek)</option>
<option value="deepseek">🐳 DeepSeek API (Reasoner & Chat)</option>
<option value="anthropic">🟣 Anthropic Claude (3.5 / 3.7 Sonnet)</option>
<option value="mistral">🔴 Mistral AI (Large / Codestral)</option>
<option value="openrouter">🪐 OpenRouter (100+ Free & Pro Modely)</option>
<option value="local">💻 Môj počítač · PC Bridge (Lokálne akcie)</option>
</select><button id="attach-image" type="button" title="Analyzovať obrázok">📎 Obrázok</button><button id="record-voice" type="button" title="Nahrať hlas">🎤 Hlas</button><button id="read-answer" type="button" title="Prečítať poslednú odpoveď">🔊 Čítať</button><button id="voice-dialogue-btn" type="button" title="Obojsmerný handsfree hovor s Trinity" class="voice-live-btn">🎙️ Live Hovor</button><button id="memory-graph-open-btn" type="button" title="Kontextový pamäťový graf">🕸️ Graf</button><input id="image-input" type="file" accept="image/png,image/jpeg,image/webp" hidden><input id="audio-input" type="file" accept="audio/*" hidden><label><input type="checkbox" id="remember"><span data-i18n="remember">Pamäť</span></label><label id="allow-files-setting"><input type="checkbox" id="allow-files"><span data-i18n="allowFiles">Súbory</span></label></div><button id="stop" type="button" hidden data-i18n="stop">Zastaviť</button><button id="send" class="primary" data-i18n="send">Odoslať ↑</button></div></form><audio id="speech-player" controls hidden></audio><small class="footnote" data-i18n="footnote">Trinity 10.3 · Pokojný priestor pre tvorbu a prácu</small></section></section>
    <section id="studio-view" class="view studio-view" hidden>
      <div class="studio-top"><div><span class="eyebrow">TRINITY AI & MULTIMEDIÁLNE ŠTÚDIO</span><h1 data-i18n="builderTitle">Tvorba Videí, Hudby, Fotiek, Prezentácií a Webov</h1><p data-i18n="builderIntro">Generuj 16:9 animované videá so zvukom a WebM exportom, polyfonickú WAV hudbu, AI fotky, interaktívne prezentácie (HTML5 + PDF), kreatívne balíky aj živé weby.</p></div><button id="studio-new" class="primary" data-i18n="newStudioProject">＋ Nový webový projekt</button></div>
      <section id="multimedia-studio-panel" class="panel domain-env-panel" style="margin-bottom:18px">
        <div class="panel-head">
          <div><span class="eyebrow">MULTIMEDIÁLNE PRODUKČNÉ CENTRUM TRINITY</span><h2>Generátor videa, hudby (.WAV), fotiek, prezentácií (Slide Deck + PDF) a kreatívnych balíkov</h2></div>
          <span id="mm-total-badge" class="detail-chip">MULTIMÉDIÁ PRIPRAVENÉ</span>
        </div>
        <nav class="trinity-subnav" id="mm-subnav" aria-label="Typ multimédií">
          <button type="button" class="subnav-btn active" data-mm-tab="video">🎬 Video & Animácie (16:9 + WebM)</button>
          <button type="button" class="subnav-btn" data-mm-tab="music">🎵 Hudba & Audio (.WAV Synth)</button>
          <button type="button" class="subnav-btn" data-mm-tab="photo">📸 Fotky & Ilustrácie (AI Flux)</button>
          <button type="button" class="subnav-btn" data-mm-tab="presentation">📊 Prezentácie (HTML5 + PDF)</button>
          <button type="button" class="subnav-btn" data-mm-tab="pack">✨ Kreatívne balíky (Infografika / Social / Brand)</button>
        </nav>

        <div id="mm-pane-video" class="mm-tab-pane">
          <form id="mm-video-form" class="secret-form commerce-form">
            <strong>🎬 Vytvoriť 16:9 animované video so zvukovou stopou a exportom do .WEBM</strong>
            <div class="commerce-form-grid">
              <label><span>Téma / scenár videa</span><input id="mm-video-prompt" required minlength="2" maxlength="2000" placeholder="napr. Promo video pre Trinity AI Cloud, autonómne domény a investície"></label>
              <label><span>Názov videa (voliteľné)</span><input id="mm-video-title" maxlength="160" placeholder="napr. Trinity AI Showreel 2026"></label>
              <label><span>Vizuálny štýl</span><select id="mm-video-style"><option value="cinematic">Filmový (Cinematic 16:9)</option><option value="cyberpunk">Kybernetický & Neón (Cyberpunk)</option><option value="business">Biznis & Korporátny (Business)</option><option value="space">Vesmír & Hlboký kozmos (Space)</option><option value="nature">Príroda & Harmónia (Nature)</option><option value="abstract">Abstraktné umenie (Abstract)</option></select></label>
              <label><span>Počet scén / Dĺžka</span><select id="mm-video-scenes"><option value="4">4 scény · 16 sekúnd</option><option value="5">5 scén · 20 sekúnd</option><option value="6">6 scén · 28 sekúnd</option></select></label>
            </div>
            <div class="commerce-form-actions">
              <button class="primary" type="submit" id="mm-video-submit">🎬 Vygenerovať 16:9 Video + Prehrávač</button>
            </div>
          </form>
        </div>

        <div id="mm-pane-music" class="mm-tab-pane" hidden>
          <form id="mm-music-form" class="secret-form commerce-form">
            <strong>🎵 Skomponovať a syntetizovať skutočnú hudobnú skladbu (.WAV 16-bit PCM)</strong>
            <div class="commerce-form-grid">
              <label><span>Popis skladby / nálada</span><input id="mm-music-prompt" required minlength="2" maxlength="1500" placeholder="napr. Epický elektronický soundtrack s basovou linkou a arpeggiom"></label>
              <label><span>Názov skladby (voliteľné)</span><input id="mm-music-title" maxlength="140" placeholder="napr. Auru Horizon"></label>
              <label><span>Hudobný žáner</span><select id="mm-music-genre"><option value="synthwave">Synthwave (118 BPM · A minor)</option><option value="cinematic">Filmová / Cinematic (96 BPM · D minor)</option><option value="ambient">Ambient & Relax (76 BPM · C major)</option><option value="lofi">L…57503 tokens truncated…it(env,`ui-evolve:${user.id}`,30,300);
      return json(await applyUiEvolution(env,user.email||user.id,await readJSON(request,30000)));
    }
  }
  if(path==='/api/assistant/documents'){
    if(request.method==='GET'){
      return json(await listTrinityDocuments(env,{
        category:url.searchParams.get('category')||'',
        search:url.searchParams.get('search')||'',
        limit:Number(url.searchParams.get('limit')||60)
      }));
    }
    if(request.method==='POST'){
      requireAdmin(user);
      await rateLimit(env,`doc-create:${user.id}`,30,300);
      return json({item:await createTrinityDocument(env,user.email||user.id,await readJSON(request,50000))},201);
    }
  }
  const docRoute=path.match(/^\/api\/assistant\/documents\/([a-zA-Z0-9_-]+)(?:\/(export|delete))?$/);
  if(docRoute){
    const docId=docRoute[1],sub=docRoute[2];
    if(request.method==='GET'&&!sub){
      const item=await getTrinityDocument(env,docId);
      return json({item});
    }
    if(request.method==='GET'&&sub==='export'){
      const format=url.searchParams.get('format')||'md';
      const item=await getTrinityDocument(env,docId);
      const file=exportTrinityDocument(item,format);
      return new Response(file.body,{headers:{'Content-Type':file.contentType,'Content-Disposition':`attachment; filename="${file.filename}"`,'Cache-Control':'no-store'}});
    }
    if(request.method==='POST'&&sub==='delete'){
      requireAdmin(user);
      return json(await deleteTrinityDocument(env,user.email||user.id,docId));
    }
  }
  if(path==='/api/assistant/brain/run'&&request.method==='POST'){requireAdmin(user);return json(await runBrainCycle(env));}
  if(path==='/api/assistant/evolution/run'&&request.method==='POST'){requireAdmin(user);return json(await runEvolutionCycle(env));}
  const mediaRoute=path.match(/^\/api\/assistant\/media\/images\/([0-9a-f-]+)$/i);
  if(mediaRoute&&request.method==='GET'){
    const id=uuid.parse(mediaRoute[1]);const object=await env.ARTIFACTS.get(`media/images/${id}.jpg`);
    if(!object)throw new HttpError(404,'Obrázok neexistuje.');
    const headers=new Headers();object.writeHttpMetadata(headers);headers.set('Cache-Control','private, max-age=86400');headers.set('Content-Disposition',`inline; filename="trinity-${id}.jpg"`);
    return new Response(object.body,{headers});
  }
  const fileRoute=path.match(/^\/api\/assistant\/files\/([0-9a-f-]+|[a-zA-Z0-9_\-.]+)\/([^/]+)$/i);
  if(fileRoute&&request.method==='GET'){
    const id=fileRoute[1];
    const fname=decodeURIComponent(fileRoute[2]);
    let key=`artifacts/${id}/${fname}`;
    let object=await env.ARTIFACTS.get(key);
    if(!object&&env.DB?.prepare){
      try{
        const row=await env.DB.prepare('SELECT r2_key,content_type FROM ops_artifacts WHERE id=? OR filename=?').bind(id,fname).first();
        if(row&&row.r2_key){
          key=row.r2_key;
          object=await env.ARTIFACTS.get(key);
        }
      }catch{}
    }
    if(!object){
      object=await env.ARTIFACTS.get(`artifacts/${id}`);
      if(!object)object=await env.ARTIFACTS.get(fname);
    }
    if(!object)throw new HttpError(404,`Súbor '${fname}' nebol nájdený v archíve.`);
    const isDownload=url.searchParams.get('download')==='1';
    const headers=new Headers();
    if(typeof object.writeHttpMetadata==='function')object.writeHttpMetadata(headers);
    if(!headers.has('Content-Type')&&object.httpMetadata?.contentType)headers.set('Content-Type',object.httpMetadata.contentType);
    if(!headers.has('Content-Type'))headers.set('Content-Type','application/octet-stream');
    headers.set('Cache-Control','private, max-age=86400');
    headers.set('Content-Disposition',`${isDownload?'attachment':'inline'}; filename="${fname}"`);
    headers.set('X-Content-Type-Options','nosniff');
    return new Response(object.body,{headers});
  }
  if(path==='/api/assistant/artifacts'){
    if(request.method==='GET'){
      return json({items:await listArtifacts(env,{limit:Number(url.searchParams.get('limit')||20),search:url.searchParams.get('search')||''})});
    }
    if(request.method==='POST'){
      const body=await readJSON(request,10_000_000);
      if(body.type==='pdf')return json({item:await createPdfArtifact(env,body)},201);
      return json({item:await createArtifact(env,body)},201);
    }
  }
  if(path==='/api/assistant/memory'){
    if(request.method==='GET')return json((await searchMemory(env,url.searchParams.get('q')||'')).records);
    if(request.method==='POST'){const d=z.object({key:z.string().min(1).max(120),value:z.string().min(1).max(10000)}).strict().parse(await readJSON(request));await env.DB.prepare("INSERT INTO ops_memory(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(d.key,d.value).run();return json({stored:true});}
  }
  if(path==='/api/assistant/memory/graph'&&request.method==='GET'){
    return json(await getGraphVisualization(env));
  }
  if(path==='/api/assistant/memory/graph/sync'&&request.method==='POST'){
    requireAdmin(user);
    return json(await syncGraphFromEcosystem(env));
  }
  if(path==='/api/assistant/changes'&&request.method==='GET')return json((await getUiEvolutionState(env)).changes);
  const uiChangeRoute=path.match(/^\/api\/assistant\/changes\/([a-zA-Z0-9_-]+)\/(approve|rollback)$/);
  if(uiChangeRoute&&request.method==='POST'){
    requireAdmin(user);
    return json(await handleUiChangeAction(env,user.email||user.id,uiChangeRoute[1],uiChangeRoute[2]));
  }
  if(path==='/api/assistant/commodities/overview'&&request.method==='GET'){
    return json(await getCommodityDeskOverview(env,user,{strategy:url.searchParams.get('strategy')||'balanced'}));
  }
  if(path==='/api/assistant/commodities/banks'){
    if(request.method==='GET')return json(await listBankConnections(env,user));
    if(request.method==='POST'){
      requireAdmin(user);
      await rateLimit(env,`commodity-banks:${user.id}`,20);
      return json(await configureBankConnection(env,user,await readJSON(request)),201);
    }
  }
  const bankDeleteRoute=path.match(/^\/api\/assistant\/commodities\/banks\/([a-zA-Z0-9_-]+)\/delete$/);
  if(bankDeleteRoute&&request.method==='POST'){
    requireAdmin(user);
    return json(await deleteBankConnection(env,user,bankDeleteRoute[1]));
  }
  if(path==='/api/assistant/commodities/sync-live'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`commodity-sync:${user.id}`,20);
    return json(await syncLiveMarketFeeds(env,user));
  }
  if(path==='/api/assistant/commodities/analyze'){
    if(request.method==='GET'){
      return json(await analyzeCommodities(env,user,{
        symbol:url.searchParams.get('symbol')||'',
        sector:url.searchParams.get('sector')||'all',
        strategy:url.searchParams.get('strategy')||'balanced',
        record_document:url.searchParams.get('record')==='1'
      }));
    }
    if(request.method==='POST'){
      return json(await analyzeCommodities(env,user,await readJSON(request)));
    }
  }
  if(path==='/api/assistant/commodities/trade'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`commodity-trade:${user.id}`,30);
    return json(await executeCommodityTrade(env,user,await readJSON(request)),201);
  }
  if(path==='/api/assistant/commodities/auto-invest'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`commodity-autoinvest:${user.id}`,15);
    return json(await runAutonomousCommodityDesk(env,user,await readJSON(request)));
  }
  if(path==='/api/assistant/commodities/chart'&&request.method==='GET'){
    return json(await getCommodityChart(env,url.searchParams.get('symbol')||'XAU-EUR',url.searchParams.get('timeframe')||'1D'));
  }
  if(path==='/api/assistant/commodities/alerts'&&request.method==='GET'){
    return json(await listPriceAlerts(env));
  }
  if(path==='/api/assistant/commodities/alerts'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,10000);
    return json(await createPriceAlert(env,user.email||user.id,body),201);
  }
  if(path==='/api/assistant/commodities/alerts/check'&&request.method==='POST'){
    requireAdmin(user);
    return json(await checkPriceAlerts(env,{notify:true}));
  }
  if(path==='/api/assistant/wallet/invoices'&&request.method==='GET'){
    return json(await listGeneratedInvoices(env));
  }
  if(path==='/api/assistant/wallet/invoices'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,10000);
    return json(await generateInvoiceWithSepaQr(env,user.email||user.id,body),201);
  }
  if(path==='/api/assistant/wallet/net-worth'&&request.method==='GET'){
    return json(await getAggregatedNetWorth(env,user.email||user.id));
  }
  if(path==='/api/assistant/integrations/status'&&request.method==='GET'){
    return json({items:await listAllIntegrations(env)});
  }
  if(path==='/api/assistant/integrations/cloudflare'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,10000);
    return json(await manageCloudflare(env,user.email||user.id,body.action||'status',body));
  }
  if(path==='/api/assistant/integrations/github'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,25000);
    return json(await manageGitHub(env,user.email||user.id,body.action||'status',body));
  }
  if(path==='/api/assistant/integrations/firecrawl'&&request.method==='POST'){
    await rateLimit(env,`firecrawl:${user.id}`,20,300);
    const body=await readJSON(request,10000);
    return json(await scrapeWithFirecrawl(env,user.email||user.id,body));
  }
  if(path==='/api/assistant/integrations/firebase'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,50000);
    return json(await manageFirebase(env,user.email||user.id,body.action||'status',body));
  }
  if(path==='/api/modules/catalog'&&request.method==='GET'){
    return json({modules:FREE_MODULES_CATALOG});
  }
  if(path==='/api/modules/weather'&&request.method==='GET'){
    const q=url.searchParams.get('q')||url.searchParams.get('location')||'Bratislava';
    return json(await fetchWeather(q));
  }
  if(path==='/api/modules/wikipedia'&&request.method==='GET'){
    const q=url.searchParams.get('q')||'Trinity';
    const lang=url.searchParams.get('lang')||'sk';
    return json(await fetchWikipedia(q,{lang}));
  }
  if(path==='/api/modules/dns'&&request.method==='GET'){
    const domain=url.searchParams.get('domain')||'auru.space';
    const type=url.searchParams.get('type')||'A';
    return json(await resolveDns(domain,type));
  }
  if(path==='/api/modules/crypto'&&request.method==='GET'){
    const coinsParam=url.searchParams.get('coins');
    const coins=coinsParam?coinsParam.split(','):['bitcoin','ethereum','solana'];
    return json(await fetchCryptoMarkets(coins));
  }
  if(path==='/api/modules/tech-news'&&request.method==='GET'){
    const limit=parseInt(url.searchParams.get('limit')||'10',10);
    return json(await fetchTechNews(limit));
  }
  if(path==='/api/modules/macro'&&request.method==='GET'){
    const country=url.searchParams.get('country')||'SVK';
    const indicator=url.searchParams.get('indicator')||'NY.GDP.MKTP.CD';
    return json(await fetchWorldBankIndicator(country,indicator));
  }
  if(path==='/api/ops/login-ticket'&&request.method==='POST'){
    await rateLimit(env,`ticket:${user.id}`,6);
    const ticket=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
    await env.DB.prepare('INSERT INTO ops_login_tickets(token_hash,expires_at) VALUES(?,?)').bind(await hash(ticket),Date.now()+120000).run();
    await env.DB.prepare('DELETE FROM ops_login_tickets WHERE expires_at<?').bind(Date.now()).run();
    return json({ticket,expires_in:120});
  }
  if(path==='/mcp'){
    if(!await pluginEnabled(env,'mcp'))throw new HttpError(503,'MCP rozšírenie je vypnuté.');
    await rateLimit(env,`mcp:${user.id}`,60);
    if(request.method==='POST'){
      const body=await readJSON(request);
      if(body.method==='tools/call'&&['dispatch_task','create_daily_plan'].includes(body.params?.name))await rateLimit(env,`job:${user.id}`,12);
      request=new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(body)});
    }
    return handleMcp(request,env,ctx,{projectControl:['admin','owner'].includes(user.role)});
  }
  if(path==='/api/ops/status'&&request.method==='GET'){
    const counts=await env.DB.prepare('SELECT status,COUNT(*) AS count FROM ops_jobs GROUP BY status').all();
    return json({name:'Trinity',version:TRINITY_VERSION,agents:AGENTS.length,identity:'single',account:{email:user.email||null,role:user.role||null},control,consciousness:false,truth_mode:'evidence-required',truth_policy_version:TRUTH_POLICY_VERSION,jobs:counts.results,
      development_access_until:env.TRINITY_DEV_UNTIL||null,
      providers:{'workers-ai':env.AI?'configured':'missing',openai:env.OPENAI_API_KEY?'configured':'missing',gemini:(await listAIProviders(env,ownerId)).items.find(item=>item.id==='gemini')?.enabled?'configured':'missing',ollama:env.OLLAMA_SECRET||env.OLLAMA_API_KEY?'configured':'missing'},
      trinity_2:{multimodal:!!env.AI,voice:!!env.AI,granular_rbac:true,visual_workflows:true,incident_monitoring:true,audit_export:true,global_worker_runtime:true},
      copilot:{engine:'active',plugins:copilotPluginRegistry.list().length,skills:skillRegistry.list().length,ecosystem:universalEcosystem.getStats()},
      memory:await env.DB.prepare('SELECT (SELECT COUNT(*) FROM ops_memory) AS notes,(SELECT COUNT(*) FROM memory_long) AS legacy,(SELECT COUNT(*) FROM ops_jobs) AS conversations').first(),
      pc_bridge:await getPCBridgeStatus(env),
      storage:{database:!!env.DB,cache:!!env.Mastermind,artifacts:!!env.ARTIFACTS,workflow:!!env.OPS_WORKFLOW}});
  }
  if(path==='/api/ops/agents'&&request.method==='GET'){
    const stats=await env.DB.prepare("SELECT agent_id,COUNT(*) AS runs,SUM(status='completed') AS completed,MAX(updated_at) AS last_run FROM ops_steps GROUP BY agent_id").all();
    return json(AGENTS.map(a=>({...a,...stats.results.find(s=>s.agent_id===a.id)})));
  }
  if(path==='/api/ops/catalog'&&request.method==='GET'){
    const plugins=await listPlugins(env);
    return json({plugins,skills:SKILLS,counts:{plugins:plugins.length,installed_plugins:plugins.filter(p=>p.installed).length,enabled_plugins:plugins.filter(p=>p.enabled).length,skills:SKILLS.length},can_manage:['admin','owner'].includes(user.role)});
  }
  if(path==='/api/ops/plugins'&&request.method==='GET')return json(await listPlugins(env));
  if(path==='/api/ops/plugins/install-all'&&request.method==='POST'){
    requireAdmin(user);
    return json(await installAllPlugins(env),201);
  }
  const pluginRoute=path.match(/^\/api\/ops\/plugins\/([a-z0-9-]+)(?:\/(test|install))?$/);
  if(pluginRoute&&request.method==='POST'){
    requireAdmin(user);
    const plugin=PLUGINS.find(p=>p.id===pluginRoute[1]);if(!plugin)throw new HttpError(404,'Neznáme rozšírenie.');
    if(pluginRoute[2]==='install')return json(await installPlugin(env,plugin.id),201);
    if(!pluginRoute[2]){
      const {enabled}=z.object({enabled:z.boolean()}).strict().parse(await readJSON(request));
      if(plugin.required&&!enabled)throw new HttpError(400,`${plugin.name} je povinná súčasť jadra Trinity.`);
      await env.DB.prepare("UPDATE ops_plugins SET enabled=?,updated_at=datetime('now') WHERE id=? AND installed=1").bind(enabled?1:0,plugin.id).run();
      return json({id:plugin.id,enabled});
    }
    await rateLimit(env,`plugin-test:${user.id}`,12);
    if(!await pluginEnabled(env,plugin.id))throw new HttpError(400,'Najprv zapni rozšírenie.');
    const cases={memory:['search_memory',{query:'trinity'}],projects:['project_snapshot',{}],monitor:['service_status',{binding:'CORE'}],web:['web_search',{query:'Cloudflare Workers official documentation'}],calculator:['calculate',{operation:'multiply',values:[6,7]}],text:['analyze_text',{text:'Trinity má spoločnú pamäť.'}],clock:['current_time',{timezone:'Europe/Bratislava'}],capabilities:['list_capabilities',{}]};
    let summary,details;
    if(cases[plugin.id]){const [tool,args]=cases[plugin.id];const result=await runTool(env,{tools:plugin.tools},tool,args);summary=plugin.id==='memory'?`${result.records.length} nájdených záznamov`:plugin.id==='projects'?`${result.projects.length} projektov, ${result.tasks.length} úloh`:plugin.id==='web'?`${result.results.length} webových výsledkov`:JSON.stringify(result);}
    if(plugin.id==='images'){const result=await runTool(env,{id:'plugin-check',tools:plugin.tools},'generate_image',{prompt:'Minimalistická žiarivá hviezda Trinity na tmavomodrom pozadí, bez textu'});details={id:result.id,url:result.url,model:result.model};summary=`Obrázok ${result.id} bol skutočne vytvorený a uložený.`;}
    if(plugin.id==='artifacts'){const key='plugin-checks/archive.txt',value='Trinity archive verification';await env.ARTIFACTS.put(key,value);const object=await env.ARTIFACTS.get(key);if(!object||await object.text()!==value)throw new HttpError(502,'Overenie archívu zlyhalo.');summary='Zápis aj čítanie R2 prešli.';}
    if(plugin.id==='mcp'){
      const check=await handleMcp(new Request(url.origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'trinity-plugin-check',version:'1'}}})}),env,ctx);
      if(check.status!==200||!(await check.text()).includes('serverInfo'))throw new HttpError(502,'MCP handshake zlyhal.');summary='MCP initialize handshake prešiel.';
    }
    if(plugin.id==='truth')summary=`Truth policy ${TRUTH_POLICY_VERSION} je aktívna; tvrdenia o externých akciách vyžadujú potvrdenie nástroja.`;
    if(!summary)summary=`Balík je nainštalovaný a jeho jadrový nástroj ${plugin.tools?.[0]||'katalóg'} je registrovaný.`;
    await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('plugin_verified',?)").bind(JSON.stringify({plugin:plugin.id,summary})).run();
    return json({status:'verified',plugin:plugin.id,summary,details});
  }
  if(path==='/api/ops/services'&&request.method==='GET')return json(await serviceStatus(env));
  if(path==='/api/ops/providers/test'&&request.method==='POST'){
    await rateLimit(env,`provider:${user.id}`,4);
    const {provider}=z.object({provider:z.enum(['workers-ai','openai','gemini','ollama','local','groq','deepseek','anthropic','mistral','openrouter'])}).parse(await readJSON(request));
    const started=Date.now();
    try{const response=await callModel(env,provider,[{role:'user',content:'Odpovedz iba: TRINITY_OK'}],256);const check=await recordAIProviderCheck(env,ownerId,{status:'verified',provider,model:response.model,latency_ms:Date.now()-started});return json({...check,response:response.text});}
    catch(e){const check=await recordAIProviderCheck(env,ownerId,{status:'failed',provider,error:e.message,latency_ms:Date.now()-started});return json(check,502);}
  }
  if(path==='/api/ops/jobs'){
    if(request.method==='POST'){await rateLimit(env,`job:${user.id}`,12);return json(await createJob(env,{...await readJSON(request),owner_mode:user.role==='owner'}),202);}
    if(request.method==='GET')return json((await env.DB.prepare('SELECT id,session_id,task,team,status,error,created_at,updated_at FROM ops_jobs ORDER BY created_at DESC,rowid DESC LIMIT 50').all()).results);
  }
  const jobRoute=path.match(/^\/api\/ops\/jobs\/([^/]+)(?:\/(artifact|cancel))?$/);
  if(jobRoute){
    const id=uuid.parse(jobRoute[1]);
    if(jobRoute[2]==='cancel'&&request.method==='POST'){
      const job=await getJob(env,id);
      if(['completed','failed','cancelled'].includes(job.status))return json({status:job.status});
      await (await env.OPS_WORKFLOW.get(id)).terminate();
      await env.DB.prepare("UPDATE ops_jobs SET status='cancelled',updated_at=datetime('now') WHERE id=? AND status<>'completed'").bind(id).run();
      await env.DB.prepare("UPDATE ops_steps SET status='cancelled',updated_at=datetime('now') WHERE job_id=? AND status IN ('pending','running')").bind(id).run();
      return json({status:'cancelled'});
    }
    if(request.method==='GET'){
      const job=await getJob(env,id);
      if(jobRoute[2]==='artifact'){
        if(!job.artifact_key)throw new HttpError(404,'Výstup ešte nie je pripravený.');
        const object=await env.ARTIFACTS.get(job.artifact_key);if(!object)throw new HttpError(404,'Súbor chýba.');
        return new Response(object.body,{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="trinity-${id}.md"`}});
      }return json(job);
    }
  }
  if(path==='/api/ops/memory'){
    if(request.method==='GET')return json(await searchMemory(env,z.string().max(200).parse(url.searchParams.get('q')||'')));
    if(request.method==='POST'){
      const {key,value}=z.object({key:z.string().min(1).max(120),value:z.string().min(1).max(10000)}).strict().parse(await readJSON(request));
      await env.DB.prepare("INSERT INTO ops_memory(key,value,source) VALUES(?,?,'user') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(key,value).run();
      return json({stored:true,key});
    }
  }
  if(path==='/api/ops/events'&&request.method==='GET')return json((await env.DB.prepare('SELECT * FROM ops_events ORDER BY id DESC LIMIT 50').all()).results);
  // Keep existing read-only project views available behind the same authentication.
  const legacyReads={'/api/workspace/projects':'projects','/api/workspace/tasks':'tasks','/api/memory/notes':'notes'};
  if(request.method==='GET'&&legacyReads[path]){
    // Table names come exclusively from this hardcoded allowlist, never user input.
    return json({items:(await env.DB.prepare(`SELECT * FROM ${legacyReads[path]} LIMIT 100`).all()).results});
  }
  throw new HttpError(404,'Táto cesta neexistuje.');
}
export default {
  async fetch(request,env,ctx){
    try{return secure(await route(request,env,ctx));}
    catch(e){const status=e instanceof z.ZodError?400:e.status||500;
      if(status===500)console.error(JSON.stringify({event:'request_failed',path:new URL(request.url).pathname}));
      return secure(json({error:status===500?'Interná chyba. Pozri záznamy služby.':e instanceof z.ZodError?'Neplatné údaje požiadavky.':e.message},status));}
  },
  async scheduled(controller,env,ctx){if(isBuildOnlyPreview(env))return;ctx.waitUntil((async()=>{const summary=await runScheduledHealth(env,controller.cron);await recordHealthIncident(env,summary);await runBrainCycle(env);await runEvolutionCycle(env);await scanForImprovements(env);})());},
  async email(message,env){if(isBuildOnlyPreview(env)){message.setReject('Build-only Preview does not accept email.');return;}await handleInboundEmail(message,env);}
};
