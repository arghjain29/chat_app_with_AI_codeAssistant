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
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
