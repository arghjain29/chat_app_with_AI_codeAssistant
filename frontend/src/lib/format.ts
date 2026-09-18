const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 hours ago", "yesterday", "in 6 days". */
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

export const ROLE_LABEL = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' } as const;

export const ROLE_HINT = {
  editor: 'Can edit files, chat and use AI',
  viewer: 'Can read files and chat',
} as const;

/** Choices for roles that can be given to someone other than the owner. */
export const ROLE_OPTIONS = (['editor', 'viewer'] as const).map((role) => ({
  value: role,
  label: ROLE_LABEL[role],
  description: ROLE_HINT[role],
}));
