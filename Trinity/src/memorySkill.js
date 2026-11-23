/**
 * @module TRINITY_OMNI_CORE
 * @subsystem MEMORY_AND_KNOWLEDGE_ENGINE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module memorySkill.js (Trinity/src/memorySkill.js) in the TRINITY OMNI-CORE ecosystem.
 */
// src/memorySkill.js

export const memorySkills = {
  /**
   * Persists a new custom command permanently in the Cloudflare D1 database.
   * Chat syntax: !skill analyze = Run a deep code audit and list 3 risks.
   */
  async learnFromChat(rawText, env) {
    if (!rawText || typeof rawText !== 'string') return null;
    const match = rawText.match(/^!skill\s+([a-zA-Z0-9_-]+)\s*=\s*(.*)$/is);
    if (!match) {
      return null;
    }

    const cmdName = match[1].toLowerCase().trim();
    const instructions = match[2].trim();

    if (!instructions) {
      throw new Error('Command instructions must not be empty.');
    }
    if (['skill', 'zoznam', 'zlepsenie'].includes(cmdName)) {
      throw new Error(`Command name !${cmdName} is reserved for a built-in command. Choose another name.`);
    }

    if (!env?.DB) {
      throw new Error('D1 database is not available to save the command.');
    }

    const write = await env.DB.prepare(
      `INSERT INTO trinity_commands (cmd_name, instructions, created_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(cmd_name) DO UPDATE SET
         instructions = excluded.instructions,
         created_at = datetime('now')`
    )
      .bind(cmdName, instructions)
      .run();

    if (write?.success === false) {
      throw new Error('Failed to save the command to the D1 database.');
    }

    // Invalidate the cached command list
    const cache = env.CACHE || env.Mastermind || null;
    if (cache && typeof cache.delete === 'function') {
      try {
        await cache.delete("trinity:learned_commands");
      } catch (_) { }
    }

    // A successful request alone is not evidence that these instructions persisted.
    // Read D1 directly, bypassing KV, before the engine can issue a completed receipt.
    const stored = await env.DB.prepare(
      'SELECT instructions FROM trinity_commands WHERE cmd_name = ?'
    ).bind(cmdName).first();
    if (stored?.instructions !== instructions) {
      throw new Error('Failed to verify persisted command in the D1 database. Check its current contents.');
    }

    return {
      learned: true,
      command: `!${cmdName}`,
      instructions,
      message: `✅ Command !${cmdName} has been permanently saved to Trinity's D1 database.`
    };
  },

  /**
   * Loads all learned commands from D1 (with fast KV cache).
   */
  async getAllCommands(env) {
    if (!env?.DB) return [];

    const cache = env.CACHE || env.Mastermind || null;
    if (cache && typeof cache.get === 'function') {
      try {
        const cached = await cache.get("trinity:learned_commands", { type: "json" });
        if (cached) return cached;
      } catch (_) { }
    }

    const { results } = await env.DB.prepare(
      "SELECT cmd_name, instructions, created_at FROM trinity_commands ORDER BY cmd_name ASC"
    ).all();

    const commands = results || [];

    if (cache && typeof cache.put === 'function') {
      try {
        await cache.put("trinity:learned_commands", JSON.stringify(commands), {
          expirationTtl: 300
        });
      } catch (_) { }
    }

    return commands;
  },

  /**
   * Checks whether a chat message invokes a previously learned command (e.g., "!analyze this text").
   */
  async resolveCustomCommand(rawText, env) {
    if (!rawText || typeof rawText !== 'string' || !rawText.startsWith("!")) return null;

    const parts = rawText.slice(1).trim().split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const userArgs = parts.slice(1).join(" ");

    if (cmdName === "zoznam") {
      const list = await this.getAllCommands(env);
      return {
        type: "list",
        commands: list,
        message: list.length > 0
          ? `Trinity learned commands list (${list.length}):\n` + list.map(c => `• !${c.cmd_name}: ${c.instructions}`).join('\n')
          : "No custom commands are saved yet. Create one using e.g.: !skill test = Check system status."
      };
    }

    if (!env?.DB) return null;

    const row = await env.DB.prepare(
      "SELECT instructions FROM trinity_commands WHERE cmd_name = ?"
    )
      .bind(cmdName)
      .first();

    if (!row) return null;

    return {
      type: "execute",
      command: `!${cmdName}`,
      instructions: row.instructions,
      expandedPrompt: `Execute stored procedure [${cmdName}]: ${row.instructions}\n\nUser input: ${userArgs || "(no additional input)"}`
    };
  }
};
