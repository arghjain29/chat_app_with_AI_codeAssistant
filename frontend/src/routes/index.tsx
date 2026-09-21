import { Show } from '@clerk/react';
import { PLANS } from '@codecollab/shared';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { ChatPreview } from '@/features/marketing/chat-preview';
import { ProductTour } from '@/features/marketing/product-tour';
import { RunPreview } from '@/features/marketing/run-preview';
import { formatInr } from '@/lib/format';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({
  component: Landing,
});

/**
 * One section of the page. Sections are separated by a hairline rather than boxed, and a
 * section with `evidence` puts a replica of the real interface beside the prose.
 */
function Band({
  title,
  lead,
  facts,
  evidence,
  flip,
  children,
}: {
  title: string;
  lead: string;
  facts?: readonly (readonly [string, string])[];
  evidence?: ReactNode;
  /** Put the evidence first on wide screens, so consecutive sections alternate. */
  flip?: boolean;
  children?: ReactNode;
}) {
  const heading = title.replace(/\s+/g, '-').toLowerCase();
  return (
    <section
      aria-labelledby={heading}
      className="border-t border-line py-16 first:border-t-0 sm:py-20"
    >
      <div
        className={cn(
          'grid gap-x-12 gap-y-8',
          evidence
            ? 'items-center lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]'
            : 'lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)]',
        )}
      >
        <div className={cn(flip && 'lg:order-2')}>
          <h2
            id={heading}
            className="max-w-md font-display text-3xl leading-tight font-semibold tracking-tight [font-stretch:88%] sm:text-4xl"
          >
            {title}
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-muted">{lead}</p>
        </div>
        {evidence}
        {facts && (
          <dl className={cn(evidence && 'lg:col-span-2')}>
            {facts.map(([term, detail]) => (
              <div key={term} className="border-t border-line py-4 sm:flex sm:gap-8">
                <dt className="font-medium sm:w-48 sm:shrink-0">{term}</dt>
                <dd className="mt-1 text-ink-muted sm:mt-0">{detail}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </div>
    </section>
  );
}

const CO_EDITING = [
  ['Live cursors', 'Everyone keeps one colour across the editor, the avatars and the chat.'],
  ['Viewers stay viewers', 'Roles are enforced on the server, not hidden in the interface.'],
  ['No save button', 'Edits persist a couple of seconds after you stop typing.'],
] as const;

const REVIEW = [
  ['Nothing applies itself', 'Changes arrive as a diff. An editor accepts or dismisses it.'],
  ['Stale work is refused', 'If the file moved on after the AI read it, the suggestion is void.'],
  ['Applied live', 'An accepted change flows through the shared document into open editors.'],
] as const;

const RUNTIME = [
  ['package.json', 'Installs, runs your dev or start script, and opens a preview.'],
  ['index.html', 'Serves the folder as a static site.'],
  ['A single Node file', 'Runs it in the terminal.'],
  ['Python, Go, Java…', 'Edit and discuss together; running those stays on your machine.'],
] as const;

const FOUNDATIONS = [
  ['Access control', 'Owner, editor and viewer roles, with invite links that expire.'],
  [
    'AI limits',
    'Per-plan quotas, a per-minute cap, one answer at a time, and a daily spend ceiling.',
  ],
  ['Untrusted input', 'Files and chat reach the model as delimited data it is told not to obey.'],
  [
    'Payments',
    'Verified webhooks, applied once, and confirmed with Razorpay before a plan changes.',
  ],
] as const;

function Landing() {
  const pro = PLANS.pro;
  const free = PLANS.free;

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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <div className="grid items-center gap-12 py-10 lg:min-h-[76dvh] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:py-16">
          <section>
            <h1 className="font-display text-5xl leading-[1.02] font-bold tracking-tight [font-stretch:88%] sm:text-6xl">
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
            <p className="mt-4 text-sm text-ink-muted">
              Free for up to {free.limits.maxOwnedProjects} projects. No card needed.
            </p>
          </section>

          <ProductTour />
        </div>

        <Band
          title="Two carets, one file"
          lead="Open a file in two browsers and you watch each other type, character by character. There is no merge step and no copy to reconcile — edits land in order and everyone is looking at the same document."
          facts={CO_EDITING}
        />

        <Band
          title="The conversation stays with the code"
          lead="Chat belongs to the project, not to a tab someone closed. Mention @ai and it answers in the same thread, streaming to everyone at once, so nobody is pasting code into a private chat window."
          evidence={<ChatPreview />}
          flip
        />

        <Band
          title="The AI suggests. A person decides."
          lead="Answers that change code arrive as a proposal, not an edit. You read the diff, then accept it or throw it away — the same review you would give a teammate."
          facts={REVIEW}
        />

        <Band
          title="Run it without leaving the tab"
          lead="Node projects install and run in the browser, on your own machine, with a live preview beside the editor. What happens depends on what is in the project."
          evidence={<RunPreview />}
          facts={RUNTIME}
        />

        <Band
          title="The unglamorous parts are done"
          lead="The kind of work that never shows up in a screenshot: who may do what, what the AI is allowed to spend, and what happens when a payment provider reports the same event twice."
          facts={FOUNDATIONS}
        />

        <section
          aria-labelledby="plans"
          className="border-t border-line py-16 sm:flex sm:items-end sm:justify-between sm:gap-10 sm:py-20"
        >
          <div>
            <h2
              id="plans"
              className="font-display text-3xl font-semibold tracking-tight [font-stretch:88%]"
            >
              Start free. Pay by the month when you outgrow it.
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
              Free covers {free.limits.maxOwnedProjects} projects and {free.limits.aiRequests.limit}{' '}
              AI requests a day. Pro removes the project limit, raises that to{' '}
              {pro.limits.aiRequests.limit.toLocaleString()} a month and brings in bigger teams, for{' '}
              {formatInr(pro.price.monthly)} a month. Nothing renews by itself.
            </p>
          </div>
          <Button asChild size="lg" className="mt-8 shrink-0 sm:mt-0">
            <Link to="/pricing" search={{ checkout: undefined }}>
              See what is in each plan
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-muted">
          <Logo />
          <nav className="flex flex-wrap gap-5">
            <Link to="/pricing" search={{ checkout: undefined }} className="hover:text-ink">
              Pricing
            </Link>
            <Link to="/sign-in/$" params={{ _splat: '' }} className="hover:text-ink">
              Sign in
            </Link>
            <Link to="/sign-up/$" params={{ _splat: '' }} className="hover:text-ink">
              Create an account
            </Link>
          </nav>
          <p>Payments run in Razorpay test mode.</p>
        </div>
      </footer>
    </div>
  );
}
