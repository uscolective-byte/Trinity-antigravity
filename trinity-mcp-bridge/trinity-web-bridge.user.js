// ==UserScript==
// @name         TRINITY <-> Gemini / ChatGPT Web MCP Bridge
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Prepojí Gemini a ChatGPT web chat s lokálnym TRINITY MCP serverom (wrangler, cmd, git)
// @match        https://gemini.google.com/*
// @match        https://chatgpt.com/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// ==/UserScript==

(function () {
  "use strict";

  const BRIDGE_URL = "http://127.0.0.1:3333/exec";
  const BRIDGE_TOKEN = "trinity-local-secret";

  console.log("[TRINITY Bridge] Tampermonkey skript aktivovaný pre", window.location.hostname);

  // Pridá tlačidlo "⚡ Spustiť v TRINITY (MCP)" ku každému JSON bloku s príkazom
  setInterval(() => {
    document.querySelectorAll("pre code").forEach((block) => {
      if (block.dataset.trinityBound) return;
      const text = block.innerText.trim();
      if (text.startsWith("{") && text.includes('"trinity_exec"')) {
        block.dataset.trinityBound = "true";
        const btn = document.createElement("button");
        btn.innerText = "⚡ Spustiť v TRINITY (MCP)";
        btn.style = "background:#10b981;color:#06101f;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;margin-top:10px;font-weight:bold;font-size:13px;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(16,185,129,0.3);";
        btn.onclick = () => executeInTrinity(text, btn);
        block.parentElement.appendChild(btn);
      }
    });
  }, 1200);

  function executeInTrinity(jsonStr, btn) {
    btn.innerText = "⏳ Vykonávam v TRINITY...";
    btn.style.background = "#f59e0b";
    
    let payload;
    try {
      payload = JSON.parse(jsonStr);
    } catch (e) {
      btn.innerText = "❌ Neplatný JSON príkaz";
      btn.style.background = "#ef4444";
      return;
    }

    GM_xmlhttpRequest({
      method: "POST",
      url: BRIDGE_URL,
      headers: {
        "Content-Type": "application/json",
        "x-trinity-token": BRIDGE_TOKEN
      },
      data: JSON.stringify(payload),
      onload: (res) => {
        try {
          const data = JSON.parse(res.responseText);
          btn.innerText = "✅ Úspešne vykonané (výstup vložený)";
          btn.style.background = "#10b981";
          
          // Hľadá vstupné pole v Gemini alebo ChatGPT
          const inputBox = document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
          if (inputBox) {
            inputBox.focus();
            const outputText = `\n[TRINITY MCP VÝSTUP]:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
            document.execCommand("insertText", false, outputText);
          }
        } catch (e) {
          btn.innerText = "⚠️ Chyba odpovede";
          btn.style.background = "#ef4444";
        }
      },
      onerror: () => {
        btn.innerText = "❌ Chyba spojenia s localhost:3333 (beží server.mjs?)";
        btn.style.background = "#ef4444";
      }
    });
  }
})();
