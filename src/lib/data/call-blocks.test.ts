import { beforeEach, describe, expect, it } from "vitest";
import { endCallBlock, getActiveCallBlock, logQuickCallResult, startCallBlock } from "./call-blocks";
import { DEMO_USER_ID, resetDemoState } from "../demo/store";

describe("call blocks (demo mode)", () => {
  beforeEach(() => {
    resetDemoState();
  });

  it("starts with zero calls completed", async () => {
    await startCallBlock(DEMO_USER_ID, { durationMinutes: 30, callTarget: 5 });
    const block = await getActiveCallBlock(DEMO_USER_ID);
    expect(block?.status).toBe("active");
    expect(block?.callsCompleted).toBe(0);
  });

  it("increments active block progress and last activity after logging a call", async () => {
    await startCallBlock(DEMO_USER_ID, { durationMinutes: 30, callTarget: 5 });

    await logQuickCallResult(DEMO_USER_ID, { answeredStatus: "answered", meaningfulConversation: true });

    const block = await getActiveCallBlock(DEMO_USER_ID);
    expect(block?.callsCompleted).toBe(1);
    expect(block?.lastActivityAt).not.toBeNull();
  });

  it("accumulates across multiple logged calls", async () => {
    await startCallBlock(DEMO_USER_ID, { durationMinutes: 30, callTarget: 5 });
    await logQuickCallResult(DEMO_USER_ID, { answeredStatus: "no_answer", meaningfulConversation: false });
    await logQuickCallResult(DEMO_USER_ID, { answeredStatus: "answered", meaningfulConversation: true });

    const block = await getActiveCallBlock(DEMO_USER_ID);
    expect(block?.callsCompleted).toBe(2);
  });

  it("ending a block clears the active block", async () => {
    const started = await startCallBlock(DEMO_USER_ID, { durationMinutes: 30, callTarget: 5 });
    await endCallBlock(DEMO_USER_ID, started.id);

    const active = await getActiveCallBlock(DEMO_USER_ID);
    expect(active).toBeNull();
  });
});
