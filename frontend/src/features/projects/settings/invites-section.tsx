import {
  INVITE_EXPIRY_DAYS,
  type AssignableRole,
  type CreatedInvite,
  type Project,
} from '@codecollab/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Link2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { relativeTime, ROLE_LABEL, ROLE_OPTIONS } from '@/lib/format';
import { invitesQuery, useCreateInvite, useRevokeInvite } from '../api';
import { Section } from './section';

const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

type ExpiryDays = (typeof INVITE_EXPIRY_DAYS)[number];

const EXPIRY_OPTIONS = INVITE_EXPIRY_DAYS.map((d) => ({
  value: String(d) as `${ExpiryDays}`,
  label: d === 1 ? '1 day' : `${d} days`,
}));

export function InvitesSection({ project }: { project: Project }) {
  const { data: invites } = useQuery(invitesQuery(project.id));
  const create = useCreateInvite(project.id);
  const revoke = useRevokeInvite(project.id);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [role, setRole] = useState<AssignableRole>('editor');
  const [expires, setExpires] = useState<`${ExpiryDays}`>('7');
  const [singleUse, setSingleUse] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    create.mutate(
      {
        role,
        expiresInDays: Number(expires) as ExpiryDays,
        maxUses: singleUse ? 1 : null,
      },
      { onSuccess: setCreated },
    );
  };

  return (
    <Section
      title="Invite links"
      description="Anyone with a link can join with the role you pick, until it expires or you turn it off."
    >
      <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="invite-role" label="Joins as">
            <Select id="invite-role" options={ROLE_OPTIONS} value={role} onValueChange={setRole} />
          </Field>
          <Field id="invite-expires" label="Expires after">
            <Select
              id="invite-expires"
              options={EXPIRY_OPTIONS}
              value={expires}
              onValueChange={setExpires}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={singleUse}
            onChange={(e) => setSingleUse(e.target.checked)}
            className="size-4 accent-cobalt"
          />
          Single use: the link stops working after one person joins
        </label>
        <div className="flex justify-end">
          <Button type="submit" disabled={create.isPending}>
            <Link2 /> {create.isPending ? 'Creating…' : 'Create invite link'}
          </Button>
        </div>
      </form>

      {created && <NewInviteLink invite={created} onDone={() => setCreated(null)} />}

      {invites && invites.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium">Active links</h3>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
                <span className="font-medium">{ROLE_LABEL[inv.role]}</span>
                <span className="text-ink-muted">
                  Expires {relativeTime(inv.expiresAt)}
                  {inv.maxUses !== null
                    ? `, ${inv.uses} of ${inv.maxUses} used`
                    : `, used ${inv.uses} ${inv.uses === 1 ? 'time' : 'times'}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-danger"
                  disabled={revoke.isPending}
                  onClick={() =>
                    revoke.mutate(inv.id, { onSuccess: () => toast.success('Link turned off') })
                  }
                >
                  Turn off
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

/** The raw link exists only in this response, so make copying it the obvious next step. */
function NewInviteLink({ invite, onDone }: { invite: CreatedInvite; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(invite.token);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
    } catch {
      toast.error('Couldn’t copy automatically. Select the link and copy it.');
    }
  };

  return (
    <div
      role="status"
      className="mt-4 rounded-xl border border-teal/50 bg-teal/8 p-4 animate-in fade-in-0 slide-in-from-top-1"
    >
      <p className="text-sm font-medium">Your invite link is ready</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        Copy it now. For security it won’t be shown again, but you can always create another.
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Invite link"
          className="font-mono text-xs"
        />
        <Button onClick={copy} variant={copied ? 'secondary' : 'primary'}>
          {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="mt-2" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
