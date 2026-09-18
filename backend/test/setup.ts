import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

// Replace Clerk with a header-driven fake: `x-test-user: <clerkId>` signs a request in.
vi.mock('../src/lib/clerk.js', () => ({
  authMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getClerkUserId: (req: { get(name: string): string | undefined }) =>
    req.get('x-test-user') ?? null,
  // WebSocket tokens are just the Clerk id in tests; "bad" is rejected.
  verifySessionToken: async (token: string) => (token && token !== 'bad' ? token : null),
  fetchClerkProfile: async (clerkId: string) => ({
    clerkId,
    email: `${clerkId}@example.com`,
    username: clerkId,
    firstName: null,
    avatarUrl: null,
  }),
}));

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
