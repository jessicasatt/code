import { z } from "zod";
import type { Weekday } from "./types";

/** Client-safe: no Supabase/server imports, so components can use this without pulling next/headers into the browser bundle. */
export const WEEKDAYS: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export const OnboardingInputSchema = z.object({
  name: z.string().min(1).max(100),
  monthlyRevenueGoalDollars: z.number().positive(),
  currentMrrDollars: z.number().min(0),
  averageClientValueDollars: z.number().positive(),
  workdays: z.array(z.enum(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"])).min(1),
  dailyCallTarget: z.number().int().positive(),
  weeklyCallTarget: z.number().int().positive(),
  morningBriefTime: z.string().regex(/^\d{2}:\d{2}$/),
  endOfDaySummaryTime: z.string().regex(/^\d{2}:\d{2}$/),
  callingHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  callingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
});
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;
