import { formatAppTime } from "../date/timezone";

export type NextActionKind = "finish_active_block" | "start_block" | "follow_up" | "target_met";

export interface NextAction {
  kind: NextActionKind;
  message: string;
}

export interface NextActionInput {
  now: Date;
  callsRemainingToday: number;
  activeWorkBlock: { callsRemaining: number; plannedEnd: string } | null;
  followUpsDue: number;
}

/**
 * Single deterministic "what should I do right now" recommendation. Always
 * one action, always phrased as an instruction with a concrete number —
 * never a probability or a motivational aside.
 */
export function buildNextAction(input: NextActionInput): NextAction {
  const { activeWorkBlock, callsRemainingToday, followUpsDue, now } = input;

  if (activeWorkBlock && activeWorkBlock.callsRemaining > 0) {
    const endLabel = formatAppTime(new Date(activeWorkBlock.plannedEnd), "h:mm a");
    return {
      kind: "finish_active_block",
      message: `Complete ${activeWorkBlock.callsRemaining} more call${activeWorkBlock.callsRemaining === 1 ? "" : "s"} before ${endLabel}.`,
    };
  }

  if (callsRemainingToday > 0) {
    return {
      kind: "start_block",
      message: `Start a call block and complete ${callsRemainingToday} more call${callsRemainingToday === 1 ? "" : "s"} today.`,
    };
  }

  if (followUpsDue > 0) {
    return {
      kind: "follow_up",
      message: `Complete ${followUpsDue} follow-up${followUpsDue === 1 ? "" : "s"} due today.`,
    };
  }

  void now;
  return {
    kind: "target_met",
    message: "You've hit your call target today. Review today's results.",
  };
}
