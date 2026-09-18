import { z } from 'zod';

const schema = z.object({
  VITE_API_URL: z.url(),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  throw new Error(
    'Missing frontend environment variables. Copy frontend/.env.example to frontend/.env.\n' +
      z.prettifyError(parsed.error),
  );
}

export const env = parsed.data;
