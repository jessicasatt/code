import { z } from "zod";

/**
 * All environment variables are validated once at startup. Anything without
 * the NEXT_PUBLIC_ prefix is server-only and must never be imported from a
 * "use client" module.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: z.string().min(1).optional(),
  HIGHLEVEL_LOCATION_ID: z.string().min(1).optional(),
  HIGHLEVEL_WEBHOOK_SHARED_SECRET: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;
let cachedPublicEnv: PublicEnv | null = null;

function parseOrThrow<T>(schema: z.ZodType<T>, source: Record<string, string | undefined>, label: string): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid ${label} environment variables:\n${issues}`);
  }
  return result.data;
}

/** Server-only secrets. Calling this from client code is a build-time error because process.env.X is inlined only for NEXT_PUBLIC_ vars. */
export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = parseOrThrow(
      serverEnvSchema,
      {
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN: process.env.HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN,
        HIGHLEVEL_LOCATION_ID: process.env.HIGHLEVEL_LOCATION_ID,
        HIGHLEVEL_WEBHOOK_SHARED_SECRET: process.env.HIGHLEVEL_WEBHOOK_SHARED_SECRET,
        VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
        VAPID_SUBJECT: process.env.VAPID_SUBJECT,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        CRON_SECRET: process.env.CRON_SECRET,
      },
      "server",
    );
  }
  return cachedServerEnv;
}

export function getPublicEnv(): PublicEnv {
  if (!cachedPublicEnv) {
    cachedPublicEnv = parseOrThrow(
      publicEnvSchema,
      {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      },
      "public",
    );
  }
  return cachedPublicEnv;
}

/** True once real Supabase credentials are configured. Until then the app runs in demo mode. */
export function isSupabaseConfigured(): boolean {
  const pub = getPublicEnv();
  return Boolean(pub.NEXT_PUBLIC_SUPABASE_URL && pub.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isHighLevelConfigured(): boolean {
  const server = getServerEnv();
  return Boolean(server.HIGHLEVEL_PRIVATE_INTEGRATION_TOKEN && server.HIGHLEVEL_LOCATION_ID);
}

export function isPushConfigured(): boolean {
  const server = getServerEnv();
  const pub = getPublicEnv();
  return Boolean(server.VAPID_PRIVATE_KEY && pub.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

export function isAiConfigured(): boolean {
  return Boolean(getServerEnv().OPENAI_API_KEY);
}
