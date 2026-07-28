import { beforeEach, describe, expect, it } from "vitest";
import { getExecuteSnapshot } from "./execute";
import { endCallBlock, startCallBlock } from "./call-blocks";
import { DEMO_USER_ID, getDemoState, resetDemoState } from "../demo/store";

describe("getExecuteSnapshot (demo mode)", () => {
  beforeEach(() => {
    resetDemoState();
  });

  it("is never inactive when there is no active block", async () => {
    const snapshot = await getExecuteSnapshot(DEMO_USER_ID);
    expect(snapshot.activeWorkBlock).toBeNull();
    expect(snapshot.isInactive).toBe(false);
  });

  it("is not inactive right after starting a block", async () => {
    await startCallBlock(DEMO_USER_ID, { durationMinutes: 30, callTarget: 10 });

    const snapshot = await getExecuteSnapshot(DEMO_USER_ID);
    expect(snapshot.activeWorkBlock).not.toBeNull();
    expect(snapshot.isInactive).toBe(false);
  });

  it("becomes inactive only once the active block's last activity is older than the threshold", async () => {
    await startCallBlock(DEMO_USER_ID, { durationMinutes: 30, callTarget: 10 });
    const block = getDemoState().workBlocks.find((b) => b.status === "active")!;
    block.lastActivityAt = new Date(Date.now() - 30 * 60_000).toISOString();

    const snapshot = await getExecuteSnapshot(DEMO_USER_ID);
    expect(snapshot.isInactive).toBe(true);
  });

  it("never reports inactivity for a scheduled/completed block, even with a stale last activity", async () => {
    const started = await startCallBlock(DEMO_USER_ID, { durationMinutes: 30, callTarget: 10 });
    const block = getDemoState().workBlocks.find((b) => b.id === started.id)!;
    block.lastActivityAt = new Date(Date.now() - 30 * 60_000).toISOString();
    await endCallBlock(DEMO_USER_ID, started.id);

    const snapshot = await getExecuteSnapshot(DEMO_USER_ID);
    expect(snapshot.activeWorkBlock).toBeNull();
    expect(snapshot.isInactive).toBe(false);
  });

  it("suggests a one-call restart block after an incomplete block ends", async () => {
    const started = await startCallBlock(DEMO_USER_ID, { durationMinutes: 30, callTarget: 10 });
    await endCallBlock(DEMO_USER_ID, started.id); // ends at 0/10 -> incomplete

    const snapshot = await getExecuteSnapshot(DEMO_USER_ID);
    expect(snapshot.suggestedBlockMode).toBe("restart");
    expect(snapshot.suggestedBlockSize).toBe(1);
  });

  it("defaults to a normal-sized suggestion with no prior activity today", async () => {
    const snapshot = await getExecuteSnapshot(DEMO_USER_ID);
    expect(snapshot.suggestedBlockMode).toBe("normal");
    expect(snapshot.suggestedBlockSize).toBe(10);
  });
});
