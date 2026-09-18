import type { UserSummary } from '@codecollab/shared';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Each person keeps the same presence colour everywhere (avatars now, cursors later). */
const PRESENCE = [
  'bg-marigold text-[#1b2233]',
  'bg-teal text-white',
  'bg-rose text-white',
  'bg-cobalt text-cobalt-ink',
];

export const presenceClass = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PRESENCE[h % PRESENCE.length]!;
};

export function Avatar({
  user,
  size = 'md',
  className,
}: {
  user: UserSummary;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const sizes = { sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-10 text-sm' };

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold',
        sizes[size],
        presenceClass(user.id),
        className,
      )}
      title={user.username}
    >
      {user.avatarUrl && !broken ? (
        <img
          src={user.avatarUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        user.username.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
