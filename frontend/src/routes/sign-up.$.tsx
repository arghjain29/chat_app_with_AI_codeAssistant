import { SignUp } from '@clerk/react';
import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/features/auth/auth-page';

export const Route = createFileRoute('/sign-up/$')({
  component: () => (
    <AuthPage>
      <SignUp routing="path" path="/sign-up" />
    </AuthPage>
  ),
});
