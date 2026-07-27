/**
 * All money is stored and calculated as integer cents. Never introduce a
 * float into a monetary code path — division for display only, and always
 * rounded back to an integer before it's treated as money again.
 */
export type Cents = number;

export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: Cents): number {
  return cents / 100;
}

export function formatCentsAsUsd(cents: Cents): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(centsToDollars(cents));
}

export function addCents(...values: Cents[]): Cents {
  return values.reduce((sum, v) => sum + Math.round(v), 0);
}

export function subtractCents(a: Cents, b: Cents): Cents {
  return Math.round(a) - Math.round(b);
}
