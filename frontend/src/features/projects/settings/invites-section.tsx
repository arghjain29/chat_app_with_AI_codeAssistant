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
import { Field, Input, Select } from '@/components/ui/input';
import { relativeTime, ROLE_HINT, ROLE_LABEL } from '@/lib/format';
import { invitesQuery, useCreateInvite, useRevokeInvite } from '../api';
import { Section } from './section';

const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

const EXPIRY_LABEL: Record<(typeof INVITE_EXPIRY_DAYS)[number], string> = {
  1: '1 day',
  7: '7 days',
  30: '30 days',
};

export function InvitesSection({ project }: { project: Project }) {
  const { data: invites } = useQuery(invitesQuery(project.id));
  const create = useCreateInvite(project.id);
  const revoke = useRevokeInvite(project.id);
  const [created, setCreated] = useState<CreatedInvite | null>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    create.mutate(
      {
        role: form.get('role') as AssignableRole,
        expiresInDays: Number(form.get('expires')) as (typeof INVITE_EXPIRY_DAYS)[number],
        maxUses: form.get('single') ? 1 : null,
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
            <Select id="invite-role" name="role" defaultValue="editor">
              {(['editor', 'viewer'] as const).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}: {ROLE_HINT[r].toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="invite-expires" label="Expires after">
            <Select id="invite-expires" name="expires" defaultValue="7">
              {INVITE_EXPIRY_DAYS.map((d) => (
                <option key={d} value={d}>
                  {EXPIRY_LABEL[d]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="single" className="size-4 accent-cobalt" />
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
