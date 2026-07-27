/**
 * Redacts values that should never reach a client-visible debugging screen:
 * phone numbers, email addresses, tokens/secrets, and recording URLs.
 * Applied recursively to arbitrary JSON before it's sent to the Webhook
 * Inspector UI. The raw payload stays in server-side storage untouched.
 */
const SENSITIVE_KEY_PATTERN = /(token|secret|authorization|api[_-]?key|recording|password)/i;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(?:\+?\d[\d\-. ()]{7,}\d)/g;
const URL_PATTERN = /https?:\/\/\S+/g;

function redactString(value: string): string {
  let out = value.replace(EMAIL_PATTERN, "[redacted-email]");
  out = out.replace(PHONE_PATTERN, "[redacted-phone]");
  out = out.replace(URL_PATTERN, (url) => (/recording|\.mp3|\.wav/i.test(url) ? "[redacted-recording-url]" : url));
  return out;
}

export function redactPayload(payload: unknown): unknown {
  if (typeof payload === "string") return redactString(payload);
  if (Array.isArray(payload)) return payload.map(redactPayload);
  if (payload && typeof payload === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = "[redacted]";
      } else {
        result[key] = redactPayload(value);
      }
    }
    return result;
  }
  return payload;
}
