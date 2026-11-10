/**
 * Trinity Local-Desktop Truth Verification Module
 * Implementuje overenie reality (Truth Assertion v3) na desktope
 * @author Basterix & Antigravity
 */

export async function executeWithTruthVerification(tool, args, runnerFn, runPowerShellFn = null) {
  const startTime = Date.now();
  const rawResult = await runnerFn();

  // Zabezpečenie číselného exitCode
  const exitCode = typeof rawResult.exitCode === 'number' ? rawResult.exitCode : 0;
  const stdout = rawResult.output || rawResult.stdout || JSON.stringify(rawResult);
  const stderr = rawResult.error || rawResult.stderr || '';

  // Ak je deklarovaný úspech, skontrolujeme skutočný dopad na OS
  if (exitCode === 0 && tool === 'desktop_window_manager' && args?.appPath && runPowerShellFn) {
    // Fyzická kontrola, či proces skutočne beží v systéme
    const psCheck = `Get-Process -Name "${args.appPath.replace('.exe', '')}" -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count`;
    const checkResult = await runPowerShellFn(psCheck);
    const count = parseInt(checkResult.output || checkResult.stdout || '0', 10) || 0;
    
    if (count === 0) {
      return {
        tool,
        exitCode: 101,
        error: `[REALITY_CHECK_FAILED] Okno ${args.appPath} nebolo nájdené medzi bežiacimi procesmi.`,
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
