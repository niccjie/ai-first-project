'use strict';
const { appendFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

// Never log provider strings verbatim: even an error message can echo a key or a prompt.
const pick = (value, allowed) => value == null ? null : allowed.includes(value) ? value : 'unrecognized';
const number = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
// Structural fingerprint only: safe primitive facts about an already-parsed value, never text.
function valueShape(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
function objectShape(value) {
  const shape = valueShape(value);
  return shape === 'object' ? Object.keys(value).length : shape;
}
function upstreamError(error) {
  if (!error || typeof error !== 'object') return {};
  const message = typeof error.message === 'string' ? error.message : '';
  let category = message ? 'provider_message_redacted' : null;
  for (const [pattern, label] of [
    [/max_output_tokens/i, 'output_token_limit'],
    [/json.?schema|text\.format|response_format/i, 'structured_output_parameter'],
    [/context.*(?:length|window)|maximum context/i, 'context_limit'],
    [/rate.?limit|too many requests/i, 'rate_limit'],
    [/authentication|api.?key|unauthori[sz]ed/i, 'authentication'],
    [/balance|quota|credit/i, 'quota'],
    [/overload|unavailable/i, 'service_unavailable']
  ]) { if (pattern.test(message)) { category = label; break; } }
  const codes = ['invalid_request_error', 'invalid_request', 'invalid_json_schema', 'invalid_api_key',
    'authentication_error', 'rate_limit_error', 'rate_limit_exceeded', 'insufficient_quota',
    'context_length_exceeded', 'server_error', 'internal_error', 'invalid_parameter',
    'model_not_found', 'content_filter', 'max_output_tokens'];
  return { error_type: pick(error.type, codes), error_code: pick(error.code, codes),
    error_message: category, error_message_redacted: Boolean(message) };
}
function responseDetails(body, extras = {}) {
  const usage = body?.usage;
  return {
    deepseek_status: pick(body?.status, ['completed', 'incomplete', 'failed', 'in_progress']),
    incomplete_reason: pick(body?.incomplete_details?.reason, ['max_output_tokens', 'content_filter']),
    ...upstreamError(body?.error),
    usage: { input_tokens: number(usage?.input_tokens), output_tokens: number(usage?.output_tokens),
      reasoning_tokens: number(usage?.output_tokens_details?.reasoning_tokens),
      cached_tokens: number(usage?.input_tokens_details?.cached_tokens), total_tokens: number(usage?.total_tokens) },
    ...extras
  };
}

// --- Persistent diagnostics -------------------------------------------------
// One NDJSON file per local day: server/logs/production-YYYYMMDD.ndjson
// Records are the same sanitized payload already written to stdout. Never
// append request bodies, prompts, credentials or generated text here.
const DEFAULT_LOG_DIR = join(__dirname, 'logs');
const dayStamp = now => `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
let currentStamp = null;
let currentLogPath = null;
let logDirectoryReady = false;
// fs failures must never break generation; file logging degrades to console-only.
const fileStorage = line => {
  try {
    const now = new Date();
    const stamp = dayStamp(now);
    if (stamp !== currentStamp) { currentLogPath = join(DEFAULT_LOG_DIR, `production-${stamp}.ndjson`); currentStamp = stamp; logDirectoryReady = false; }
    if (!logDirectoryReady) { mkdirSync(DEFAULT_LOG_DIR, { recursive: true }); logDirectoryReady = true; }
    appendFileSync(currentLogPath, line + '\n');
  } catch { logDirectoryReady = false; }
};
function writeDiagnostic(context, event, details = {}, storage = fileStorage) {
  // Callers supply only local labels, numeric metadata and explicitly sanitized fields.
  const record = JSON.stringify({ time: new Date().toISOString(), ...context, event, ...details });
  console.info('[production]', record);
  if (typeof storage === 'function') storage(record);
}
module.exports = { upstreamError, responseDetails, writeDiagnostic, valueShape, objectShape,
  diagnosticsLogDirectory: DEFAULT_LOG_DIR };
