/**
 * Trinity Logger — Structured JSON logging with correlation IDs
 * 
 * Propagates across service bindings with trace_id and session_id.
 * Persists to D1 (trinity_trace_log) and optionally to KV.
 * 
 * @version 1.0.0
 * @author Trinity Team
 */

// === TRACE ID GENERATION ===

/**
 * Generates a unique trace ID in UUID v4 format
 */
export function generateTraceId() {
  return crypto.randomUUID();
}

/**
 * Generates a shortened trace ID for header propagation
 */
export function shortTraceId() {
  return generateTraceId().split('-')[0];
}

// === LOG LEVELS ===

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};

// === TRINITY LOGGER CLASS ===

export class TrinityLogger {
  constructor(env, options = {}) {
    this.env = env;
    this.db = env.DB || env.TRINITY_D1;
    this.kv = env.TRINITY_KV;
    this.enabled = options.enabled !== false;
    this.level = options.level || 'info';
    this.sampleRate = options.sampleRate || 1.0;
    this.maxPayloadBytes = options.maxPayloadBytes || 4096;
    this.persistToD1 = options.persistToD1 !== false;
    this.persistToKV = options.persistToKV || false;
    this.environment = options.environment || 'production';
  }

  /**
   * Creates a new trace context for a request
   */
  startTrace(options = {}) {
    const traceId = options.traceId || generateTraceId();
    const sessionId = options.sessionId || null;
    const parentTraceId = options.parentTraceId || null;
    
    return {
      traceId,
      sessionId,
      parentTraceId,
      startTime: Date.now(),
      spans: [],
      
      /**
       * Starts a new span within the trace
       */
      startSpan(source, targetType, eventType) {
        const span = {
          spanId: generateTraceId(),
          source,
          target: targetType,
          eventType,
          startTime: Date.now(),
          endTime: null,
          status: 'ok',
          durationMs: null
        };
        this.spans.push(span);
        return span;
      },
      
      /**
       * Ends a span
       */
      endSpan(span, status = 'ok') {
        span.endTime = Date.now();
        span.durationMs = span.endTime - span.startTime;
        span.status = status;
      },
      
      /**
       * Returns the total duration of the trace
       */
      totalDuration() {
        return Date.now() - this.startTime;
      }
    };
  }

  /**
   * Primary logging method
   */
  async log(level, source, eventType, message, data = {}, trace = null) {
    if (!this.enabled) return;
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) return;
    
    // Sampling
    if (Math.random() > this.sampleRate) return;
    
    const logEntry = {
      id: generateTraceId(),
      trace_id: trace?.traceId || null,
      session_id: trace?.sessionId || null,
      parent_trace_id: trace?.parentTraceId || null,
      source,
      target: data.target || null,
      event_type: eventType,
      severity: level,
      message,
      payload_json: this._sanitizePayload(data),
      duration_ms: data.durationMs || null,
      status: data.status || 'ok',
      environment: this.environment,
      created_at: new Date().toISOString()
    };

    // Console output (for Workers Tail)
    const consoleMsg = `[${level.toUpperCase()}] ${source} → ${eventType}: ${message}`;
    if (level === 'error' || level === 'fatal') {
      console.error(consoleMsg, JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }

    // Persist to D1
    if (this.persistToD1 && this.db) {
      try {
        await this.db.prepare(
          `INSERT INTO trinity_trace_log 
           (id, trace_id, session_id, parent_trace_id, source, target, event_type, severity, message, payload_json, duration_ms, status, environment)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          logEntry.id, logEntry.trace_id, logEntry.session_id, logEntry.parent_trace_id,
          logEntry.source, logEntry.target, logEntry.event_type, logEntry.severity,
          logEntry.message, logEntry.payload_json, logEntry.duration_ms,
          logEntry.status, logEntry.environment
        ).run();
      } catch (e) {
        console.error('Logger D1 write failed:', e.message);
      }
    }

    // Persist to KV (optional, for hot reads)
    if (this.persistToKV && this.kv) {
      try {
        const key = `trace:${logEntry.trace_id}:${logEntry.id}`;
        await this.kv.put(key, JSON.stringify(logEntry), { expirationTtl: 3600 });
      } catch (e) {
        // KV is best-effort
      }
    }

    return logEntry;
  }

  /**
   * Sanitizes payload — removes sensitive data and truncates
   */
  _sanitizePayload(data) {
    const sanitized = { ...data };
    
    // Redact sensitive fields
    const sensitive = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    for (const key of Object.keys(sanitized)) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    let json = JSON.stringify(sanitized);
    if (json.length > this.maxPayloadBytes) {
      json = json.substring(0, this.maxPayloadBytes) + '...[truncated]';
    }
    return json;
  }

  // === Convenience methods ===
  async debug(source, eventType, message, data, trace) { return this.log('debug', source, eventType, message, data, trace); }
  async info(source, eventType, message, data, trace) { return this.log('info', source, eventType, message, data, trace); }
  async warn(source, eventType, message, data, trace) { return this.log('warn', source, eventType, message, data, trace); }
  async error(source, eventType, message, data, trace) { return this.log('error', source, eventType, message, data, trace); }
  async fatal(source, eventType, message, data, trace) { return this.log('fatal', source, eventType, message, data, trace); }
}

// === TRACE PROPAGATION HELPERS ===

/**
 * Extracts trace IDs from an incoming request (headers or body)
 */
export function extractTraceFromRequest(request) {
  const headers = request.headers;
  return {
    traceId: headers.get('X-Trinity-Trace-Id') || null,
    sessionId: headers.get('X-Trinity-Session-Id') || null,
    parentTraceId: headers.get('X-Trinity-Parent-Trace-Id') || null
  };
}

/**
 * Adds trace IDs to response headers for propagation
 */
export function injectTraceIntoResponse(response, trace) {
  if (!trace) return response;
  const headers = new Headers(response.headers);
  if (trace.traceId) headers.set('X-Trinity-Trace-Id', trace.traceId);
  if (trace.sessionId) headers.set('X-Trinity-Session-Id', trace.sessionId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Adds trace IDs to fetch headers for service binding calls
 */
export function injectTraceIntoFetch(init, trace) {
  if (!trace) return init;
  const headers = new Headers(init.headers || {});
  headers.set('X-Trinity-Trace-Id', trace.traceId);
  if (trace.sessionId) headers.set('X-Trinity-Session-Id', trace.sessionId);
  if (trace.parentTraceId) headers.set('X-Trinity-Parent-Trace-Id', trace.parentTraceId);
  return { ...init, headers };
}

// === MIDDLEWARE WRAPPER ===

/**
 * Middleware for a Worker fetch handler — automatically creates a trace
 */
export function withTracing(handler) {
  return async (request, env, ctx) => {
    const logger = new TrinityLogger(env);
    const existingTrace = extractTraceFromRequest(request);
    const trace = logger.startTrace(existingTrace);
    
    logger.info('worker', 'request.start', `Incoming ${request.method} ${request.url}`, {
      method: request.method,
      url: request.url,
      target: 'trinity-worker'
    }, trace);

    try {
      const response = await handler(request, env, ctx, trace, logger);
      
      logger.info('worker', 'request.end', `Completed ${request.method} ${request.url}`, {
        status: response.status,
        durationMs: trace.totalDuration()
      }, trace);
      
      return injectTraceIntoResponse(response, trace);
    } catch (error) {
      logger.error('worker', 'request.error', error.message, {
        error: error.stack,
        durationMs: trace.totalDuration(),
        status: 'error'
      }, trace);
      
      return new Response(JSON.stringify({ 
        error: 'Internal error',
        trace_id: trace.traceId 
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'X-Trinity-Trace-Id': trace.traceId
        }
      });
    }
  };
}

// === SERVICE BINDING WRAPPER ===

/**
 * Wrapper for service binding calls — automatically logs and propagates trace context
 */
export async function callService(serviceBinding, path, options, trace, logger, sourceName, targetName) {
  const span = trace?.startSpan(sourceName, targetName, 'service.call');
  
  const fetchOptions = injectTraceIntoFetch(options || {}, trace);
  fetchOptions.method = fetchOptions.method || 'POST';
  
  try {
    const response = await serviceBinding.fetch(path, fetchOptions);
    
    logger?.info(sourceName, 'service.response', `${targetName} responded`, {
      target: targetName,
      path,
      status: response.status,
      durationMs: span ? Date.now() - span.startTime : null
    }, trace);
    
    if (span) trace.endSpan(span, response.ok ? 'ok' : 'error');
    return response;
  } catch (error) {
    logger?.error(sourceName, 'service.error', `${targetName} failed: ${error.message}`, {
      target: targetName,
      path,
      error: error.message,
      durationMs: span ? Date.now() - span.startTime : null
    }, trace);
    
    if (span) trace.endSpan(span, 'error');
    throw error;
  }
}
