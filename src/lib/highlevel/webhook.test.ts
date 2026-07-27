import { describe, expect, it } from "vitest";
import { computeDedupeKey, detectEventType, extractExternalEventId, isDuplicateEvent } from "./webhook";

describe("detectEventType", () => {
  it("finds the event type under any of the common field names", () => {
    expect(detectEventType({ type: "CallCompleted" })).toBe("CallCompleted");
    expect(detectEventType({ event: "call.completed" })).toBe("call.completed");
    expect(detectEventType({ eventType: "call.completed" })).toBe("call.completed");
  });

  it("falls back to unknown rather than guessing", () => {
    expect(detectEventType({ foo: "bar" })).toBe("unknown");
  });
});

describe("extractExternalEventId", () => {
  it("reads the id from common field names", () => {
    expect(extractExternalEventId({ id: "abc123" })).toBe("abc123");
    expect(extractExternalEventId({ eventId: "abc123" })).toBe("abc123");
  });

  it("coerces a numeric id to string", () => {
    expect(extractExternalEventId({ id: 42 })).toBe("42");
  });

  it("returns null when no id field is present", () => {
    expect(extractExternalEventId({ foo: "bar" })).toBeNull();
  });
});

describe("computeDedupeKey / isDuplicateEvent", () => {
  it("prefers the provider event id when present", () => {
    const key = computeDedupeKey({ externalEventId: "evt_1", rawBody: "{}" });
    expect(key).toBe("id:evt_1");
  });

  it("falls back to a content hash when there is no event id", () => {
    const key = computeDedupeKey({ externalEventId: null, rawBody: '{"a":1}' });
    expect(key.startsWith("hash:")).toBe(true);
  });

  it("produces the same hash for identical bodies (exact redelivery)", () => {
    const a = computeDedupeKey({ externalEventId: null, rawBody: '{"a":1}' });
    const b = computeDedupeKey({ externalEventId: null, rawBody: '{"a":1}' });
    expect(a).toBe(b);
  });

  it("produces different hashes for different bodies", () => {
    const a = computeDedupeKey({ externalEventId: null, rawBody: '{"a":1}' });
    const b = computeDedupeKey({ externalEventId: null, rawBody: '{"a":2}' });
    expect(a).not.toBe(b);
  });

  it("flags a key as duplicate only once it has been seen", () => {
    const seen = new Set<string>();
    const key = computeDedupeKey({ externalEventId: "evt_1", rawBody: "{}" });
    expect(isDuplicateEvent(key, seen)).toBe(false);
    seen.add(key);
    expect(isDuplicateEvent(key, seen)).toBe(true);
  });
});
