import { Show } from '@clerk/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { EditorPreview } from '@/features/marketing/editor-preview';

export const Route = createFileRoute('/')({
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/pricing" search={{ checkout: undefined }}>
              Pricing
            </Link>
          </Button>
          <ThemeToggle />
          <Show when="signed-out">
            <Button asChild variant="ghost" size="sm">
              <Link to="/sign-in/$" params={{ _splat: '' }}>
                Sign in
              </Link>
            </Button>
          </Show>
          <Show when="signed-in">
            <Button asChild size="sm">
              <Link to="/dashboard">Open your projects</Link>
            </Button>
          </Show>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 pt-8 pb-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section>
          <h1 className="font-display text-5xl leading-[1.02] font-bold tracking-tight font-stretch:88% sm:text-6xl">
            Write code in the same file, at the same time.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-muted">
            CodeCollab is a shared editor with team chat and an AI pair-programmer. Everyone sees
            the same code, the same conversation and the same AI suggestions, live.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/sign-up/$" params={{ _splat: '' }}>
                Start a free project
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/sign-in/$" params={{ _splat: '' }}>
                Sign in
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-ink-muted">Free for up to 3 projects. No card needed.</p>
        </section>

        <EditorPreview />
      </main>
    </div>
  );
}
