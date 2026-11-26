/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module SkillForge.js (Trinity/src/v4/SkillForge.js) in the TRINITY OMNI-CORE ecosystem.
 */
/**
 * Trinity SkillForge v10.4
 * Autonomous synthesis, registration, verification, and execution of new Trinity capabilities.
 */

export class SkillForge {
  constructor(storage = null, env = {}) {
    this.storage = storage;
    this.env = env;
    this.runtimeRegistry = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    if (this.storage) {
      try {
        const saved = await this.storage.get('forged_skills');
        if (saved && typeof saved === 'object') {
          for (const [name, def] of Object.entries(saved)) {
            this.runtimeRegistry.set(name, def);
          }
        }
      } catch (err) {
        console.warn('SkillForge init warning:', err?.message || err);
      }
    }
    this.initialized = true;
  }

  /**
   * Forges a new skill specification from QCE-Fusion.
   * Only marks the skill executable when a real callable handler function is supplied.
   */
  async forgeSkillFromQCE(skillSpec, { cycleId, genome }) {
    await this.init();
    const skillName = skillSpec?.name || `dynamic_${Date.now().toString(36)}`;
    const hasHandler = typeof skillSpec?.handler === 'function';

    const forgedSkill = {
      name: skillName,
      task: skillSpec?.task || 'Synthesized task',
      archetype: skillSpec?.archetype || 'creator',
      generation: genome?.generation || 1,
      cycleId,
      created_at: new Date().toISOString(),
      executable: hasHandler,
      status: hasHandler ? 'registered_in_memory' : 'spec_only',
      handler: hasHandler ? skillSpec.handler : null
    };

    this.runtimeRegistry.set(skillName, forgedSkill);

    if (this.storage) {
      try {
        const persistable = {};
        for (const [k, v] of this.runtimeRegistry.entries()) {
          persistable[k] = {
            name: v.name,
            task: v.task,
            archetype: v.archetype,
            generation: v.generation,
            created_at: v.created_at,
            executable: false,
            status: 'spec_only'
          };
        }
        await this.storage.put('forged_skills', persistable);
      } catch (err) {
        console.warn('SkillForge persist error:', err?.message || err);
      }
    }

    return forgedSkill;
  }

  /**
   * Executes a skill from the runtime registry. Fails closed if no real handler exists.
   */
  async execute(skillName, params = {}) {
    await this.init();
    const skill = this.runtimeRegistry.get(skillName);
    if (!skill) {
      return { success: false, error: `Skill "${skillName}" is not registered in SkillForge.` };
    }

    if (typeof skill.handler !== 'function') {
      return {
        success: false,
        skillName,
        executable: false,
        error: `Skill "${skillName}" is not executable (specification only or reloaded without a runtime handler).`
      };
    }

    try {
      const output = await skill.handler(params);
      return { success: true, skillName, result: output };
    } catch (err) {
      return { success: false, skillName, error: err?.message || String(err) };
    }
  }
}
