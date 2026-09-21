import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A looping tour of the workspace: one mock of the app with a camera that pans and zooms
 * from scene to scene, revealing more as it goes. It plays only while on screen, and holds
 * still (fully revealed) for anyone who prefers reduced motion.
 */

interface Scene {
  caption: string;
  /** Where the camera looks, as a point on the mock, and how close it gets. */
  x: number;
  y: number;
  scale: number;
  ms: number;
}

const SCENES: Scene[] = [
  { caption: 'One workspace: files, code, chat and a terminal', x: 50, y: 50, scale: 1, ms: 3000 },
  { caption: 'Two people typing in the same file', x: 46, y: 40, scale: 1.65, ms: 4000 },
  { caption: 'Ask @ai where everyone can see the answer', x: 93, y: 38, scale: 1.75, ms: 4200 },
  { caption: 'Read the diff, then accept it', x: 64, y: 95, scale: 1.25, ms: 4400 },
  { caption: 'Run it without leaving the tab', x: 45, y: 97, scale: 1.2, ms: 4000 },
];

const TYPED_LINE = "  if (!invite) throw new NotFound('Invite');";

/** Line 6 is typed live; 8 is replaced by 9 once the AI's change is accepted. */
const CODE = [
  { n: 1, code: "import { Invite } from './models';" },
  { n: 2, code: "import { Gone, NotFound } from '../errors';" },
  { n: 3, code: '' },
  { n: 4, code: 'export async function acceptInvite(token, user) {' },
  { n: 5, code: '  const invite = await Invite.findByToken(token);' },
  { n: 6, code: TYPED_LINE },
  { n: 7, code: '' },
  { n: 8, code: '  if (invite.expiresAt < Date.now()) return null;' },
  { n: 9, code: "  if (invite.expiresAt < Date.now()) throw new Gone('Invite expired');" },
  { n: 10, code: '' },
  { n: 11, code: '  const member = await invite.project.addMember(user, invite.role);' },
  { n: 12, code: '  await invite.markUsed(user);' },
  { n: 13, code: '  return member;' },
  { n: 14, code: '}' },
];

const FILES = [
  ['src', 0],
  ['accept.js', 1],
  ['invite.js', 1],
  ['project.js', 1],
  ['errors.js', 1],
  ['test', 0],
  ['accept.test.js', 1],
  ['package.json', 0],
] as const;

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Reveal one character at a time while `on` is true, from however far the clock has run. */
function useTyped(text: string, on: boolean, speed = 42) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!on) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const shown = Math.min(text.length, Math.floor((now - start) / speed));
      setCount(shown);
      if (shown < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, on, speed]);
  return on ? text.slice(0, count) : '';
}

function Caret({ name, className }: { name: string; className: string }) {
  return (
    <span className="relative inline-block h-[1.1em] w-0 align-text-bottom">
      <span className={cn('absolute inset-y-0 left-0 w-[1.5px]', className)} />
      <span
        className={cn(
          'absolute -top-[0.95em] left-0 rounded-[2px] rounded-bl-none px-1 font-sans text-[7px] leading-[1.35] font-bold text-[#1b2233]',
          className,
        )}
      >
        {name}
      </span>
    </span>
  );
}

export function ProductTour() {
  const reduced = prefersReducedMotion();
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const frame = useRef<HTMLDivElement>(null);

  // Only run while the tour is actually on screen.
  useEffect(() => {
    const el = frame.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(([entry]) => setPlaying(!!entry?.isIntersecting), {
      threshold: 0.35,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), SCENES[scene]!.ms);
    return () => clearTimeout(id);
  }, [scene, playing]);

  // Reduced motion gets the finished state: everything revealed, camera pulled back.
  const at = reduced ? SCENES.length - 1 : scene;
  const shot = reduced ? SCENES[0]! : SCENES[scene]!;
  const typed = useTyped(TYPED_LINE, !reduced && scene === 1);
  const accepted = at >= 4;

  return (
    <figure className="m-0">
      <div
        ref={frame}
        className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-30px_rgb(27_34_51/0.45)]"
      >
        <div
          aria-hidden
          className="absolute inset-0 grid grid-rows-[auto_1fr_auto] bg-surface transition-transform duration-[900ms] ease-[cubic-bezier(.22,.61,.36,1)] motion-reduce:transition-none"
          style={{
            transform: `scale(${shot.scale})`,
            transformOrigin: `${shot.x}% ${shot.y}%`,
          }}
        >
          {/* Title bar */}
          <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
            <span className="font-mono text-[10px] text-ink-muted">
              invites-api / src/invites/accept.js
            </span>
            <div className="flex -space-x-1">
              {[
                ['M', 'bg-marigold text-[#1b2233]'],
                ['D', 'bg-teal text-white'],
                ['AI', 'bg-cobalt text-cobalt-ink'],
              ].map(([initial, tone]) => (
                <span
                  key={initial}
                  className={cn(
                    'grid size-4 place-items-center rounded-full text-[7px] font-bold ring-1 ring-surface',
                    tone,
                  )}
                >
                  {initial}
                </span>
              ))}
            </div>
          </div>

          <div className="grid min-h-0 grid-cols-[15%_1fr_27%]">
            {/* File tree */}
            <div className="border-r border-line bg-surface-2/40 px-2 py-1.5">
              {FILES.map(([name, depth]) => (
                <p
                  key={name}
                  className={cn(
                    'truncate py-[3px] font-mono text-[9px]',
                    name === 'accept.js' ? 'font-semibold text-cobalt' : 'text-ink-muted',
                    depth === 1 && 'pl-2',
                  )}
                >
                  {name}
                </p>
              ))}
            </div>

            {/* Editor */}
            <pre className="overflow-hidden py-1.5 font-mono text-[10px] leading-[1.85]">
              {CODE.filter((l) => !(l.n === 9 && at < 3) && !(l.n === 8 && accepted)).map(
                (l, i) => {
                  const isRemoval = l.n === 8;
                  const isAddition = l.n === 9;
                  return (
                    <div
                      key={l.n}
                      className={cn(
                        'flex pr-3',
                        at >= 3 && isRemoval && 'bg-rose/12 line-through decoration-rose/70',
                        at >= 3 && isAddition && 'bg-teal/15',
                      )}
                    >
                      <span className="w-7 shrink-0 pr-2 text-right text-ink-muted/60 select-none">
                        {i + 1}
                      </span>
                      <code className="whitespace-pre">
                        {l.n === 6 ? (
                          <>
                            {reduced || at > 1 ? TYPED_LINE : typed}
                            {scene === 1 && <Caret name="maya" className="bg-marigold" />}
                          </>
                        ) : l.n === 11 ? (
                          <>
                            {'  const member = await invite.project.'}
                            {scene === 1 && <Caret name="dev" className="bg-teal" />}
                            {'addMember(user, invite.role);'}
                          </>
                        ) : (
                          l.code
                        )}
                      </code>
                    </div>
                  );
                },
              )}
            </pre>

            {/* Chat */}
            <div className="grid min-h-0 content-start gap-1.5 border-l border-line px-2 py-1.5 text-[9px]">
              <p className="font-sans font-semibold text-ink-muted">Chat</p>
              <p className="rounded-md rounded-tl-none bg-surface-2 px-1.5 py-1 leading-snug">
                Invite links never expire. Should they?
              </p>
              {at >= 2 && (
                <p className="ml-3 rounded-md rounded-tr-none bg-cobalt px-1.5 py-1 leading-snug text-cobalt-ink">
                  <span className="font-bold">@ai</span> expire them after 7 days and return 410
                </p>
              )}
              {at >= 3 && (
                <p className="rounded-md rounded-tl-none border border-cobalt/30 bg-surface-2 px-1.5 py-1 leading-snug">
                  Done — invites now carry an expiry and return 410 Gone once it passes.
                  <span className="mt-1 block text-ink-muted">2 files changed</span>
                </p>
              )}
              {accepted && (
                <p className="ml-3 rounded-md rounded-tr-none bg-cobalt px-1.5 py-1 leading-snug text-cobalt-ink">
                  Accepted — running the tests now
                </p>
              )}
            </div>
          </div>

          {/* The bottom rail: status, then the proposal, then what it runs. */}
          <div className="border-t border-line bg-surface-2/40">
            {at < 3 && (
              <div className="mx-auto flex w-[84%] items-center justify-between py-1.5 font-mono text-[9px] text-ink-muted">
                <span>main · 3 collaborators</span>
                <span>Saved</span>
              </div>
            )}
            {at === 3 && (
              <div className="mx-auto flex w-[84%] items-center justify-between gap-2 py-1.5 text-[9px]">
                <span>
                  <span className="font-bold">AI</span> suggests throwing once an invite has expired
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded border border-line bg-surface px-1.5 py-0.5">
                    Dismiss
                  </span>
                  <span className="relative rounded bg-cobalt px-1.5 py-0.5 text-cobalt-ink">
                    Accept
                    {/* The pointer arrives, then the click lands. */}
                    <span className="absolute right-0 -bottom-1.5 size-2.5 rotate-[-20deg] bg-ink [clip-path:polygon(0_0,0_100%,30%_75%,55%_100%,72%_88%,48%_62%,100%_45%)]" />
                    <span className="absolute inset-0 animate-ping rounded bg-cobalt/40 motion-reduce:hidden" />
                  </span>
                </span>
              </div>
            )}
            {accepted && (
              <div className="mx-auto grid w-[84%] grid-cols-[1fr_34%] gap-2 py-1.5 font-mono text-[9px] leading-[1.7]">
                <div>
                  <p className="font-semibold">$ npm test</p>
                  <p className="text-teal">✓ returns 410 once an invite has expired</p>
                  <p className="text-ink-muted">2 files changed · 14 tests passed</p>
                </div>
                <div className="rounded border border-line bg-paper p-1.5">
                  <div className="h-1 w-8 rounded-full bg-cobalt/70" />
                  <div className="mt-1 h-0.5 w-full rounded-full bg-surface-2" />
                  <div className="mt-0.5 h-0.5 w-3/5 rounded-full bg-surface-2" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <figcaption className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {reduced ? 'A workspace with files, code, chat and a terminal' : shot.caption}
        </p>
        {!reduced && (
          <div className="ml-auto flex gap-1.5">
            {SCENES.map((s, i) => (
              <button
                key={s.caption}
                onClick={() => setScene(i)}
                aria-label={s.caption}
                aria-current={i === scene}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === scene ? 'w-6 bg-cobalt' : 'w-1.5 bg-line hover:bg-ink-muted',
                )}
              />
            ))}
          </div>
        )}
      </figcaption>
    </figure>
  );
}
