import { describe, expect, it } from "vitest";
import { mapHighLevelCallMessage, mapHighLevelContact } from "./mappers";

describe("mapHighLevelContact", () => {
  it("prefers a combined first/last name over contactName", () => {
    const contact = mapHighLevelContact("user-1", {
      id: "hl-1",
      firstName: "Frank",
      lastName: "Rivera",
      contactName: "(805) 555-0100",
      companyName: "Solarponics Inc",
      tags: ["solar"],
      dateUpdated: "2026-07-10T22:33:39.660Z",
    });
    expect(contact.contactName).toBe("Frank Rivera");
    expect(contact.businessName).toBe("Solarponics Inc");
    expect(contact.tags).toEqual(["solar"]);
  });

  it("falls back to contactName when no first/last name is present", () => {
    const contact = mapHighLevelContact("user-1", {
      id: "hl-2",
      contactName: "(831) 331-5518",
      tags: [],
    });
    expect(contact.contactName).toBe("(831) 331-5518");
  });
});

describe("mapHighLevelCallMessage", () => {
  it("maps a completed outbound call, matching a real observed payload", () => {
    const call = mapHighLevelCallMessage("user-1", "contact-uuid-1", {
      id: "aUCvuRVqceGbQeXJgw8a",
      direction: "outbound",
      dateAdded: "2026-07-27T20:29:42.157Z",
      dateUpdated: "2026-07-27T20:30:14.330Z",
      meta: { call: { duration: 28, status: "completed" } },
      altId: "CAace04b2edc59c80603e6d394e76720cf",
      messageType: "TYPE_CALL",
    });

    expect(call.externalId).toBe("CAace04b2edc59c80603e6d394e76720cf");
    expect(call.direction).toBe("outbound");
    expect(call.durationSeconds).toBe(28);
    expect(call.answeredStatus).toBe("answered");
    expect(call.voicemailStatus).toBe(false);
    expect(call.meaningfulConversation).toBeNull();
  });

  it("maps a voicemail call, matching a real observed payload", () => {
    const call = mapHighLevelCallMessage("user-1", "contact-uuid-2", {
      id: "LlAEN7FmZyU8OGQppNf8",
      direction: "inbound",
      dateAdded: "2026-07-27T20:47:45.857Z",
      meta: { call: { duration: null, status: "voicemail" } },
      altId: "CA08ae9cfb6a0233cc773bc81a9e9ce20d",
      messageType: "TYPE_CALL",
    });

    expect(call.answeredStatus).toBe("voicemail");
    expect(call.voicemailStatus).toBe(true);
    expect(call.durationSeconds).toBeNull();
  });

  it("falls back to the message id when no altId is present", () => {
    const call = mapHighLevelCallMessage("user-1", null, {
      id: "msg-only-id",
      direction: "inbound",
      dateAdded: "2026-07-27T20:47:45.857Z",
      meta: { call: {} },
      messageType: "TYPE_CALL",
    });
    expect(call.externalId).toBe("msg-only-id");
    expect(call.answeredStatus).toBe("unknown");
  });
});
