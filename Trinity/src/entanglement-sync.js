/**
 * @module TRINITY_OMNI_CORE
 * @subsystem ENTANGLEMENT_SYNC
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module entanglement-sync.js (Trinity/src/entanglement-sync.js).
 * Provides polling-free state mirroring (Event-driven / SSE / Webhook).
 */

import { EventEmitter } from 'node:events';

export class EntanglementBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessionId = options.sessionId || 'omniverse-session';
    this.peers = new Set();
    this.history = [];
    this.maxHistory = options.maxHistory || 100;
  }

  /**
   * Publishes a state change event (Entanglement State Change).
   * @param {string} eventName - Event name (e.g., 'state-change', 'intent-collapse')
   * @param {object} payload - State payload
   */
  emitStateChange(eventName, payload = {}) {
    const event = {
      channel: eventName,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      status: payload.status || 'SYNCED',
      data: payload
    };

    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Local immediate dispatch (EventBus)
    this.emit(eventName, event);
    this.emit('*', event);

    return event;
  }

  /**
   * Registers an SSE / Webhook subscriber for real-time streaming.
   * @param {Function} peerWriter - Function sending data to the client (e.g., an SSE stream controller)
   */
  registerPeer(peerWriter) {
    this.peers.add(peerWriter);
    return () => {
      this.peers.delete(peerWriter);
    };
  }

  /**
   * Broadcasts an event to all connected peers (Edge Worker -> Local Bridge).
   * @param {object} event
   */
  broadcastToPeers(event) {
    const message = `data: ${JSON.stringify(event)}\n\n`;
    for (const peer of this.peers) {
      try {
        peer(message);
      } catch (err) {
        this.peers.delete(peer);
      }
    }
  }
}

// Global instance for the Trinity runtime
export const globalEntanglementBridge = new EntanglementBridge();
