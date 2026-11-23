/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Module control.js (Trinity/src/control.js) in the TRINITY OMNI-CORE ecosystem.
 */
import {HttpError} from './security.js';
export async function readControl(env){
  const row=await env.DB.prepare('SELECT emergency_stop,reason,updated_by,updated_at FROM ops_control WHERE id=1').first();
  return {emergency_stop:Boolean(row?.emergency_stop),reason:row?.reason||null,updated_by:row?.updated_by||null,updated_at:row?.updated_at||null};
}
export function assertRunning(control){if(control.emergency_stop)throw new HttpError(503,'Trinity is paused under owner emergency stop.');}
