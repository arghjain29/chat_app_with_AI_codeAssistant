import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { invitePreviewQuery, useAcceptInvite } from '@/features/projects/api';
import { ApiError } from '@/lib/api';
import { ROLE_HINT, ROLE_LABEL } from '@/lib/format';

export const Route = createFileRoute('/_app/invite/$token')({
  component: AcceptInvite,
});

function AcceptInvite() {
  const { token } = Route.useParams();
  const { data: invite, error, isPending } = useQuery(invitePreviewQuery(token));
  const accept = useAcceptInvite(token);
  const navigate = useNavigate();

  const open = (projectId: string) =>
    navigate({ to: '/projects/$projectId', params: { projectId } });

  return (
    <div className="mx-auto grid max-w-md px-4 py-20">
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        {isPending ? (
          <div aria-busy="true" className="grid justify-items-center gap-3">
            <span className="size-12 animate-pulse rounded-full bg-surface-2" />
            <span className="h-6 w-48 animate-pulse rounded bg-surface-2" />
            <span className="h-4 w-64 animate-pulse rounded bg-surface-2" />
          </div>
        ) : error ? (
          <InviteError error={error} />
        ) : (
          <>
            <Avatar user={invite.owner} size="lg" className="mx-auto size-12" />
            <h1 className="mt-4 font-display text-2xl font-semibold text-balance">
              {invite.alreadyMember
                ? `You’re already in ${invite.projectName}`
                : `Join ${invite.projectName}`}
            </h1>
            <p className="mt-2 text-ink-muted">
              {invite.alreadyMember
                ? 'This invite is for a project you already belong to.'
                : `${invite.owner.username} invited you as ${ROLE_LABEL[invite.role].toLowerCase()}. ${ROLE_HINT[invite.role]}. ${invite.memberCount} ${invite.memberCount === 1 ? 'person is' : 'people are'} already in.`}
            </p>
            {accept.error && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {accept.error instanceof ApiError
                  ? accept.error.message
                  : 'Couldn’t join. Try again.'}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-2">
              {invite.alreadyMember ? (
                <Button onClick={() => open(invite.projectId)}>Open project</Button>
              ) : (
                <Button
                  disabled={accept.isPending}
                  onClick={() =>
                    accept.mutate(undefined, {
                      onSuccess: ({ projectId }) => {
                        toast.success(`You joined ${invite.projectName}`);
                        void open(projectId);
                      },
                    })
                  }
                >
                  {accept.isPending
                    ? 'Joining…'
                    : `Join as ${ROLE_LABEL[invite.role].toLowerCase()}`}
                </Button>
              )}
              <Button asChild variant="ghost">
                <Link to="/dashboard">Not now</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InviteError({ error }: { error: Error }) {
  const status = error instanceof ApiError ? error.status : 0;
  const title =
    status === 410
      ? 'This invite link no longer works'
      : status === 404
        ? 'This invite link isn’t valid'
        : 'Couldn’t open this invite';
  const body =
    status === 404
      ? 'Check that you copied the whole link, or ask the project owner for a new one.'
      : error.message;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-ink-muted">{body}</p>
      <Button asChild variant="secondary" className="mt-6">
        <Link to="/dashboard">Go to your projects</Link>
      </Button>
    </>
  );
}
