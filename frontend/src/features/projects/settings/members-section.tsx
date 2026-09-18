import { PLANS, type AssignableRole, type Member, type Project } from '@codecollab/shared';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { MoreHorizontal, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select } from '@/components/ui/select';
import { useMe } from '@/features/auth/use-me';
import { relativeTime, ROLE_LABEL, ROLE_OPTIONS } from '@/lib/format';
import { membersQuery, useLeaveProject, useRemoveMember, useUpdateMemberRole } from '../api';
import { Section } from './section';

export function MembersSection({ project }: { project: Project }) {
  const { data: me } = useMe();
  const { data: members, isPending } = useQuery(membersQuery(project.id));
  const isOwner = project.role === 'owner';
  const [removing, setRemoving] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState(false);

  const updateRole = useUpdateMemberRole(project.id);
  const remove = useRemoveMember(project.id);
  const leave = useLeaveProject(project.id, me?.id ?? '');
  const navigate = useNavigate();

  return (
    <Section
      title="People"
      description={
        <>
          Editors can change code and use AI. Viewers can read and chat.{' '}
          {isOwner &&
            me &&
            `The ${PLANS[me.plan].name} plan allows ${PLANS[me.plan].limits.maxMembersPerProject - 1} collaborators per project.`}
        </>
      }
    >
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {isPending &&
          Array.from({ length: 2 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 p-4">
              <span className="size-8 animate-pulse rounded-full bg-surface-2" />
              <span className="h-4 w-32 animate-pulse rounded bg-surface-2" />
            </li>
          ))}
        {members?.map((m) => {
          const isMe = m.id === me?.id;
          return (
            <li key={m.id} className="flex items-center gap-3 p-4">
              <Avatar user={m} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.username} {isMe && <span className="font-normal text-ink-muted">(you)</span>}
                </p>
                <p className="text-xs text-ink-muted">Joined {relativeTime(m.joinedAt)}</p>
              </div>

              {isOwner && m.role !== 'owner' ? (
                <>
                  <Select
                    aria-label={`Role for ${m.username}`}
                    options={ROLE_OPTIONS}
                    value={m.role as AssignableRole}
                    onValueChange={(role) => {
                      if (role !== m.role) updateRole.mutate({ userId: m.id, role });
                    }}
                    size="sm"
                    className="w-28"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`More for ${m.username}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem destructive onSelect={() => setRemoving(m)}>
                        <UserMinus /> Remove from project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <span className="text-sm text-ink-muted">{ROLE_LABEL[m.role]}</span>
              )}
            </li>
          );
        })}
      </ul>

      {!isOwner && (
        <Button variant="secondary" className="mt-4" onClick={() => setLeaving(true)}>
          Leave project
        </Button>
      )}

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent
          title={`Remove ${removing?.username}?`}
          description="They lose access right away. You can invite them again later."
        >
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() =>
                removing &&
                remove.mutate(removing.id, {
                  onSuccess: () => {
                    toast.success(`Removed ${removing.username}`);
                    setRemoving(null);
                  },
                })
              }
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent
          title={`Leave ${project.name}?`}
          description="You’ll need a new invite link to come back."
        >
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Stay</Button>
            </DialogClose>
            <Button
              variant="danger"
              disabled={leave.isPending}
              onClick={() =>
                leave.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(`You left ${project.name}`);
                    void navigate({ to: '/dashboard' });
                  },
                })
              }
            >
              Leave project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
