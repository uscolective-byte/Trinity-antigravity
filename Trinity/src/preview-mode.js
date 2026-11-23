/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Preview mode guard (Trinity/src/preview-mode.js) in the TRINITY OMNI-CORE ecosystem.
 */
// A build-only Preview verifies packaging, not integrations or production access.
export function isBuildOnlyPreview(env) {
  return env?.TRINITY_PREVIEW_MODE === 'build-only';
}

export function buildOnlyPreviewResponse(request, env, {version, agents}) {
  if (!isBuildOnlyPreview(env)) return null;
  const path = new URL(request.url).pathname;
  const evidence = {
    service: 'Trinity', version, mode: 'build-only',
    data_access: 'blocked', integration_validation: 'not-performed'
  };
  const options = status => ({status, headers: {'Cache-Control': 'no-store'}});
  if (request.method === 'GET' && ['/health', '/api/health'].includes(path)) {
    return Response.json({...evidence, agents, status: 'serving'}, options(200));
  }
  if (request.method === 'GET' && path === '/ready') {
    return Response.json({
      ...evidence, ready: false, status: 'integration-testing-disabled',
      missing: ['preview.integration-configuration']
    }, options(503));
  }
  return Response.json({
    ...evidence,
    error: 'This preview verifies the build only. Login, MCP, data access, and task execution are disabled.'
  }, options(503));
}