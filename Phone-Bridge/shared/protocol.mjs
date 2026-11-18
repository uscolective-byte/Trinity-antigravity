/** Trinity Phone Bridge: shared, runtime-neutral command validation. No device execution is implied. */
export const ACTIONS = Object.freeze(['device.info','file.create','file.read','notification.show']);
export function validateCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) throw new Error('Invalid command');
  const {id,deviceId,action,payload={},expiresAt} = command;
  if (typeof id !== 'string' || !/^[a-f0-9-]{16,64}$/i.test(id)) throw new Error('Invalid command id');
  if (typeof deviceId !== 'string' || !/^[a-z0-9_-]{8,64}$/i.test(deviceId)) throw new Error('Invalid device id');
  if (!ACTIONS.includes(action)) throw new Error('Unsupported action');
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now()+60000) throw new Error('Expired or excessive TTL');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid payload');
  if (JSON.stringify(payload).length > 16384) throw new Error('Payload too large');
  if (action.startsWith('file.')) {
    if (typeof payload.path !== 'string' || payload.path.length > 240 || !/^[a-zA-Z0-9_./ -]+$/.test(payload.path) || payload.path.startsWith('/') || payload.path.split('/').some(x=>x==='..'||x==='.'||x==='')) throw new Error('Unsafe relative path');
  }
  if (action === 'file.create' && (typeof payload.content !== 'string' || payload.content.length > 12000)) throw new Error('Invalid file content');
  if (action === 'notification.show' && (typeof payload.title !== 'string' || payload.title.length > 100 || typeof payload.body !== 'string' || payload.body.length > 500)) throw new Error('Invalid notification');
  return {id,deviceId,action,payload,expiresAt};
}
export function receipt(command, status, details={}) {
  if (!['rejected','approved','executed','failed'].includes(status)) throw new Error('Invalid status');
  return {commandId:command.id,deviceId:command.deviceId,action:command.action,status,observedAt:new Date().toISOString(),details};
}
