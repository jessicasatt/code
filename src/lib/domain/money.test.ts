import { describe, expect, it } from "vitest";
import { addCents, centsToDollars, dollarsToCents, formatCentsAsUsd, subtractCents } from "./money";

describe("money", () => {
  it("converts dollars to cents without float drift", () => {
    expect(dollarsToCents(10)).toBe(1000);
    expect(dollarsToCents(10.1)).toBe(1010);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30); // classic float trap: 0.1+0.2=0.30000000000000004
  });

  it("converts cents back to dollars", () => {
    expect(centsToDollars(1000)).toBe(10);
    expect(centsToDollars(1250)).toBe(12.5);
  });

  it("formats cents as whole-dollar USD", () => {
    expect(formatCentsAsUsd(1000000)).toBe("$10,000");
    expect(formatCentsAsUsd(425000)).toBe("$4,250");
  });

  it("adds and subtracts cents as integers", () => {
    expect(addCents(100, 250, 50)).toBe(400);
    expect(subtractCents(1000, 250)).toBe(750);
  });

  it("rounds fractional cent inputs rather than truncating silently", () => {
    expect(addCents(100.4, 100.4)).toBe(200); // 100 + 100 (each rounds down alone)
    expect(subtractCents(100.6, 0)).toBe(101);
  });
});
