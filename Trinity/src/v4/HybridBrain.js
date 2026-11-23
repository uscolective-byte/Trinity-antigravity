/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module HybridBrain.js (Trinity/src/v4/HybridBrain.js) in the TRINITY OMNI-CORE ecosystem.
 */
/**
 * Trinity HybridBrain v10.4
 * Intelligent compute routing: Cloudflare Workers / Durable Object vs local PC Bridge.
 */

export class HybridBrain {
  constructor(env = {}) {
    this.env = env;
    this.bridgeAvailable = false;
  }

  async init() {
    this.bridgeAvailable = Boolean(this.env.PC_BRIDGE_SERVICE || this.env.PC_BRIDGE_V2 || this.env.BRIDGE_SHARED_SECRET);
  }

  /**
   * Decides whether a task runs in the cloud or is routed to the local PC Bridge.
   * @param {{metaContext: any, clientMeta: any, taskComplexity?: string}} param0
   * @returns {Promise<'CLOUD_DO'|'PC_BRIDGE'>}
   */
  async routeDecision({ metaContext, clientMeta = {}, taskComplexity = 'AUTO' }) {
    await this.init();

    // Check if a local action is explicitly requested (e.g., files, processes, local tools)
    const isLocalRequired = metaContext?.semanticIntent === 'ACTION' ||
      clientMeta.requiresLocalExecution === true ||
      taskComplexity === 'LOCAL_BRIDGE';

    // When the bridge is available and the task requires local execution, route to PC_BRIDGE
    if (this.bridgeAvailable && isLocalRequired) {
      return 'PC_BRIDGE';
    }

    return 'CLOUD_DO';
  }

  /**
   * Dispatches an execution request to the local PC Bridge.
   */
  async dispatchToLocalBridge(decision) {
    if (!this.bridgeAvailable) {
      return {
        success: false,
        error: 'PC Bridge is neither configured nor available.',
        fallbackContext: 'CLOUD_FALLBACK_APPLIED'
      };
    }

    // Attempt to invoke the internal Cloudflare service binding for PC Bridge
    const bridgeService = this.env.PC_BRIDGE_V2 || this.env.PC_BRIDGE_SERVICE;
    if (bridgeService && typeof bridgeService.fetch === 'function') {
      try {
        const resp = await bridgeService.fetch('https://pc-bridge.internal/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.env.TRINITY_GATEWAY_KEY || this.env.BRIDGE_SHARED_SECRET || ''}`
          },
          body: JSON.stringify(decision)
        });
        const data = await resp.json();
        return { success: true, bridgeData: data, context: 'SERVICE_BINDING' };
      } catch (err) {
        return { success: false, error: err?.message || err, fallbackContext: 'SERVICE_BINDING_ERROR' };
      }
    }

    return {
      success: false, context: 'PC_BRIDGE_UNAVAILABLE', error: 'PC Bridge is not connected.',
      task: decision.task,
      dispatchedAt: new Date().toISOString()
    };
  }
}
