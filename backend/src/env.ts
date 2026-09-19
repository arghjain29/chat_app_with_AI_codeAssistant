import { z } from 'zod';

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file: rely on the real environment.
  }
}

/** Optional string where an empty value (`FOO=`) counts as unset. */
const optionalString = z
  .string()
  .optional()
  .transform((v) => v || undefined);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  FRONTEND_URL: z
    .string()
    .min(1)
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  MONGO_URI: z.string().min(1),
  // Redis: either a full REDIS_URL, or the host/port/password shown in the provider dashboard.
  REDIS_URL: optionalString,
  REDIS_HOST: optionalString,
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  REDIS_USERNAME: optionalString,
  REDIS_PASSWORD: optionalString,
  REDIS_TLS: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: optionalString,

  // AI. One provider key is enough; models without a key are skipped.
  GEMINI_API_KEY: optionalString,
  /** v1 name for the Gemini key, still accepted. */
  GOOGLE_AI_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  /** Ordered fallbacks as provider:model, e.g. "gemini:gemini-3.5-flash-lite,gemini:gemini-3.8-flash". */
  AI_FAST_MODELS: z
    .string()
    .default('gemini:gemini-3.5-flash-lite,gemini:gemini-3.8-flash,anthropic:claude-haiku-4-5'),
  AI_PREMIUM_MODELS: z
    .string()
    .default('anthropic:claude-sonnet-5,gemini:gemini-3.1-pro-preview,gemini:gemini-3.8-flash'),
  /** Safety net: stop all AI answers for the day once estimated spend reaches this. */
  AI_DAILY_BUDGET_USD: z.coerce.number().positive().default(2),

  // Payments (Stripe). Without a key, billing is switched off and everyone stays on Free.
  STRIPE_SECRET_KEY: optionalString,
  /** From the Stripe dashboard webhook endpoint, or `stripe listen` when developing. */
  STRIPE_WEBHOOK_SECRET: optionalString,
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  GEMINI_API_KEY: parsed.data.GEMINI_API_KEY ?? parsed.data.GOOGLE_AI_KEY,
};
export const isProd = env.NODE_ENV === 'production';
