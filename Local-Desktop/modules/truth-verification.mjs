/**
 * Trinity Local-Desktop Truth Verification Module
 * Implementuje overenie reality (Truth Assertion v3) na desktope
 * @author Basterix & Antigravity
 */

const SAFE_PROCESS_NAME_RE = /^[a-zA-Z0-9._-]+$/;
const SHELL_METACHAR_RE = /[;&|`$"'<>()\r\n]/;
const PATH_TRAVERSAL_RE = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

export function extractSafeProcessName(appPath) {
  if (typeof appPath !== 'string') return null;
  const trimmed = appPath.trim();
  if (!trimmed || SHELL_METACHAR_RE.test(trimmed) || PATH_TRAVERSAL_RE.test(trimmed)) return null;
  const base = trimmed.split(/[\\/]/).pop() || '';
  const processName = base.replace(/\.exe$/i, '');
  if (!processName || !SAFE_PROCESS_NAME_RE.test(processName)) return null;
  return processName;
}

export async function executeWithTruthVerification(tool, args, runnerFn, runPowerShellFn = null) {
  const startTime = Date.now();
  const rawResult = await runnerFn();

  // Fail closed when rawResult or numeric exitCode is missing
  const hasNumericExitCode = typeof rawResult?.exitCode === 'number' && Number.isFinite(rawResult.exitCode);
  const exitCode = hasNumericExitCode ? rawResult.exitCode : 1;
  const stdout = rawResult?.output || rawResult?.stdout || (rawResult ? JSON.stringify(rawResult) : '');
  const stderr = rawResult?.error || rawResult?.stderr || (hasNumericExitCode ? '' : 'Missing numeric exitCode from runner (failed closed).');

  // Ak je deklarovaný úspech, skontrolujeme skutočný dopad na OS
  if (exitCode === 0 && tool === 'desktop_window_manager' && args?.appPath && runPowerShellFn) {
    const safeProcessName = extractSafeProcessName(args.appPath);
    if (!safeProcessName) {
      return {
        tool,
        exitCode: 102,
        error: '[SECURITY_BLOCKED] Invalid appPath for OS process verification.',
        stdout: '',
        stderr: 'Invalid or unsafe process name rejected.',
        executionTimeMs: Date.now() - startTime
      };
    }

    // Fyzická kontrola, či proces skutočne beží v systéme
    const psCheck = `Get-Process -Name "${safeProcessName}" -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count`;
    const checkResult = await runPowerShellFn(psCheck);
    const count = parseInt(checkResult?.output || checkResult?.stdout || '0', 10) || 0;

    if (count === 0) {
      return {
        tool,
        exitCode: 101,
        error: `[REALITY_CHECK_FAILED] Okno ${safeProcessName} nebolo nájdené medzi bežiacimi procesmi.`,
        stdout: '',
        stderr: 'Proces nebeží v OS',
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  return {
    tool,
    exitCode,
    stdout,
    stderr,
    executionTimeMs: Date.now() - startTime
  };
}
