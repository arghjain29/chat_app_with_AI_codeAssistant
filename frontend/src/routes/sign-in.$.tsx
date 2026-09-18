import { SignIn } from '@clerk/react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { safeRedirect } from '@/features/auth/auth';
import { AuthPage } from '@/features/auth/auth-page';

export const Route = createFileRoute('/sign-in/$')({
  // Clerk's form renders nothing for someone already signed in, so send them on instead.
  beforeLoad: async ({ context, search }) => {
    await context.auth.ready();
    if (context.auth.isSignedIn()) {
      throw redirect({ href: safeRedirect((search as { redirect_url?: unknown }).redirect_url) });
    }
  },
  component: () => (
    <AuthPage>
      <SignIn routing="path" path="/sign-in" />
    </AuthPage>
  ),
});
