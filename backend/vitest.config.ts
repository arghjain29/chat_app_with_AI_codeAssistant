import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      MONGO_URI: 'mongodb://placeholder/overridden-in-setup',
      FRONTEND_URL: 'http://localhost:5173',
      CLERK_SECRET_KEY: 'sk_test_placeholder',
      CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
      LOG_LEVEL: 'silent',
    },
  },
});
