import type { WorkBlockStatus } from "./types";

/**
 * Deterministic block-sizing rules, checked in before any AI layer exists.
 * Core principle: never assign the entire mountain — assign the next
 * hill. A rep who just got interrupted should be asked to make one call,
 * not confront the full remaining daily target.
 */
export interface BlockSizingConfig {
  /** Default block size on a normal day with no recent interruption. */
  normalBlockSize: number;
  /** Block size offered immediately after an inactivity-triggered restart. */
  restartBlockSize: number;
  /** Block size offered after a restart block is completed successfully. */
  postRestartBlockSize: number;
  /** Block size offered after a full block completes cleanly (momentum continues). */
  highMomentumBlockSize: number;
  /** At or below this many calls remaining, show the exact count rather than a rounded target. */
  nearCompletionThreshold: number;
}

export const DEFAULT_BLOCK_SIZING_CONFIG: BlockSizingConfig = {
  normalBlockSize: 10,
  restartBlockSize: 1,
  postRestartBlockSize: 4,
  highMomentumBlockSize: 10,
  nearCompletionThreshold: 3,
};

export type SuggestedBlockMode = "normal" | "restart" | "post_restart_recovery" | "high_momentum";

export interface PastBlockSummary {
  status: WorkBlockStatus;
  callTarget: number;
  callsCompleted: number;
}

/**
 * Looks only at the most recently ended block today to decide what to
 * suggest next. An incomplete/cancelled block (however it ended) lowers
 * the bar back down; a fully completed small "restart" block raises it a
 * little; a fully completed normal-or-larger block keeps momentum going.
 */
export function determineSuggestedBlockMode(lastBlockToday: PastBlockSummary | null): SuggestedBlockMode {
  if (!lastBlockToday) return "normal";

  const completedFully = lastBlockToday.status === "completed" && lastBlockToday.callsCompleted >= lastBlockToday.callTarget;
  if (!completedFully) return "restart";

  // Just completed a tiny restart block successfully -> raise the bar a
  // little rather than jumping straight back to a full-size block.
  if (lastBlockToday.callTarget <= DEFAULT_BLOCK_SIZING_CONFIG.restartBlockSize) return "post_restart_recovery";
  return "high_momentum";
}

export function suggestBlockSize(mode: SuggestedBlockMode, config: BlockSizingConfig = DEFAULT_BLOCK_SIZING_CONFIG): number {
  switch (mode) {
    case "restart":
      return config.restartBlockSize;
    case "post_restart_recovery":
      return config.postRestartBlockSize;
    case "normal":
      return config.normalBlockSize;
    case "high_momentum":
      return config.highMomentumBlockSize;
  }
}

/** Rough duration estimate for a suggested block size, shown alongside the suggestion (not a hard limit). */
export function estimateBlockMinutes(callTarget: number, minutesPerCall = 4): number {
  return Math.max(5, callTarget * minutesPerCall);
}
