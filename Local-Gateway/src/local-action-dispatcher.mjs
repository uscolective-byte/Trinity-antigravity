/**
 * Trinity Local Action Dispatcher
 * Priame vykonávanie akcií na počítači bez zbytočných filozofických vrstiev.
 * Prijme požiadavku -> vykoná na OS -> vráti výsledok do Trinity.
 */

import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const IS_WIN = process.platform === "win32";

export const actions = {
  /**
   * Spustenie bežnej aplikácie (Notepad, Kalkulačka, Prehliadač, VS Code atď.)
   */
  open_app: async (target) => {
    return new Promise((resolve) => {
      let command = "";
      const lower = String(target || "").toLowerCase().trim();

      if (IS_WIN) {
        if (lower.includes("notepad") || lower.includes("poznamk")) {
          command = "start notepad.exe";
        } else if (lower.includes("calc") || lower.includes("kalkul")) {
          command = "start calc.exe";
        } else if (lower.includes("chrome")) {
          command = "start chrome";
        } else if (lower.includes("code") || lower.includes("vs")) {
          command = "code";
        } else if (lower.includes("explorer") || lower.includes("priecinok")) {
          command = "start explorer .";
        } else {
          // Všeobecný štart pre Windows aplikácie / cesty
          command = `start "" "${target}"`;
        }
      } else {
        // macOS / Linux
        command = process.platform === "darwin" ? `open -a "${target}"` : `xdg-open "${target}"`;
      }

      exec(command, (error) => {
        if (error) {
          return resolve({ success: false, output: `Chyba pri spúšťaní: ${error.message}` });
        }
        resolve({ success: true, output: `Aplikácia "${target}" bola úspešne spustená na počítači.` });
      });
    });
  },

  /**
   * Otvorenie konkrétnej webovej stránky v predvolenom prehliadači
   */
  open_url: async (url) => {
    return new Promise((resolve) => {
      const sanitizedUrl = String(url || "").startsWith("http://") || String(url || "").startsWith("https://")
        ? url
        : `https://${url}`;
      const cmd = IS_WIN
        ? `start "" "${sanitizedUrl}"`
        : (process.platform === "darwin" ? `open "${sanitizedUrl}"` : `xdg-open "${sanitizedUrl}"`);

      exec(cmd, (err) => {
        if (err) return resolve({ success: false, output: err.message });
        resolve({ success: true, output: `Webová stránka ${sanitizedUrl} otvorená v prehliadači.` });
      });
    });
  },

  /**
   * Vytvorenie nového súboru s obsahom
   */
  create_file: async ({ filePath, content } = {}) => {
    try {
      if (!filePath) return { success: false, output: "Chýba cesta k súboru (filePath)." };
      const fullPath = path.resolve(filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content || "", "utf-8");
      return { success: true, output: `Súbor vytvorený: ${fullPath}` };
    } catch (err) {
      return { success: false, output: `Chyba zápisu: ${err.message}` };
    }
  },

  /**
   * Zistenie základného stavu systému (aby Trinity vedela, čo sa na PC deje)
   */
  system_status: async () => {
    const freeMem = Math.round(os.freemem() / (1024 * 1024));
    const totalMem = Math.round(os.totalmem() / (1024 * 1024));
    return {
      success: true,
      output: `Počítač beží (${os.type()} ${os.release()}). Pamäť: ${freeMem} MB voľných z ${totalMem} MB. Domovský priečinok: ${os.homedir()}`
    };
  },

  /**
   * Vykonanie bežného vývojárskeho príkazu (git, npm, dir/ls)
   */
  run_cmd: async (commandString) => {
    return new Promise((resolve) => {
      if (!commandString || typeof commandString !== 'string') {
        return resolve({ success: false, output: "Chýba príkaz na vykonanie." });
      }
      exec(commandString, { timeout: 20000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
        if (err) {
          return resolve({ success: false, output: (stderr || err.message).trim() });
        }
        resolve({ success: true, output: (stdout || "Príkaz prebehol bez textového výstupu.").trim() });
      });
    });
  }
};

/**
 * Spracuje prichádzajúci príkaz z Trinity
 * @param {string} actionType - 'open_app' | 'open_url' | 'create_file' | 'system_status' | 'run_cmd'
 * @param {any} payload - argumenty pre akciu
 */
export async function dispatchAction(actionType, payload) {
  const handler = actions[actionType];
  if (!handler) {
    return {
      success: false,
      output: `Neznámy typ akcie: "${actionType}". Dostupné: ${Object.keys(actions).join(', ')}`
    };
  }
  try {
    return await handler(payload);
  } catch (err) {
    return {
      success: false,
      output: `Chyba pri vykonávaní akcie ${actionType}: ${err.message}`
    };
  }
}
