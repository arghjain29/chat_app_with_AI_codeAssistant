import { SignIn } from '@clerk/react';
import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/features/auth/auth-page';

export const Route = createFileRoute('/sign-in/$')({
  component: () => (
    <AuthPage>
      <SignIn routing="path" path="/sign-in" />
    </AuthPage>
  ),
});
