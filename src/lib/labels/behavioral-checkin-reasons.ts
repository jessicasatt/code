import type { BehavioralCheckinReason } from "../domain/types";

export const CHECKIN_REASON_LABELS: Record<BehavioralCheckinReason, string> = {
  anxiety: "Anxiety",
  rejection: "Rejection",
  distracted: "Distracted",
  low_energy: "Low energy",
  other_work: "Other work",
  technical_issue: "Technical issue",
  bad_lead_list: "Bad lead list",
  needed_a_break: "Needed a break",
  completed_activity_elsewhere: "Completed activity elsewhere",
};
