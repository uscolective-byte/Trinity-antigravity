/**
 * Fail-closed local PC Bridge dispatcher.
 *
 * Never execute arbitrary shell commands received from chat, cloud workers or
 * remote clients. A higher-level authenticated and approved local agent may
 * register typed actions in a future release.
 */
export async function executeLocalBridgeCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    return {
      success: false,
      verified: false,
      error: 'ARBITRARY_SHELL_DISABLED',
      message: 'Free-form PowerShell commands are prohibited. Use an authorized typed action.'
    };
  }
  if (command.action === 'ping' && Object.keys(command).every(key => key === 'action')) {
    return {
      success: true,
      verified: true,
      action: 'ping',
      output: 'Local bridge module reached (no PC action executed).'
    };
  }
  return {
    success: false,
    verified: false,
    error: 'ACTION_NOT_ALLOWED',
    message: 'No local side-effecting action is enabled without a verified authorization and approval bridge.'
  };
}
