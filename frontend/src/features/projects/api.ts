import type {
  AssignableRole,
  CreatedInvite,
  CreateInviteInput,
  CreateProjectInput,
  Invite,
  InvitePreview,
  Member,
  Project,
  UpdateProjectInput,
} from '@codecollab/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
  members: (id: string) => ['projects', id, 'members'] as const,
  invites: (id: string) => ['projects', id, 'invites'] as const,
};

export const projectsQuery = queryOptions({
  queryKey: projectKeys.all,
  queryFn: () => api<Project[]>('/projects'),
});

export const projectQuery = (id: string) =>
  queryOptions({
    queryKey: projectKeys.detail(id),
    queryFn: () => api<Project>(`/projects/${id}`),
  });

export const membersQuery = (id: string) =>
  queryOptions({
    queryKey: projectKeys.members(id),
    queryFn: () => api<Member[]>(`/projects/${id}/members`),
  });

export const invitesQuery = (id: string) =>
  queryOptions({
    queryKey: projectKeys.invites(id),
    queryFn: () => api<Invite[]>(`/projects/${id}/invites`),
  });

export const invitePreviewQuery = (token: string) =>
  queryOptions({
    queryKey: ['invite', token],
    queryFn: () => api<InvitePreview>(`/invites/${token}`),
    retry: false,
  });

/** Show a mutation failure as a toast, in the server's own words. Plan limits link to pricing. */
export const toastError = (err: unknown) => {
  const message = err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
  const planLimit = err instanceof ApiError && err.code === 'PLAN_LIMIT';
  toast.error(message, {
    action: planLimit
      ? { label: 'See plans', onClick: () => window.location.assign('/pricing') }
      : undefined,
  });
};

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      api<Project>('/projects', { method: 'POST', ...json(input) }),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(project.id), project);
      void qc.invalidateQueries({ queryKey: projectKeys.all, exact: true });
    },
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) =>
      api<Project>(`/projects/${id}`, { method: 'PATCH', ...json(input) }),
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(id), project);
      void qc.invalidateQueries({ queryKey: projectKeys.all, exact: true });
    },
    onError: toastError,
  });
}

export function useDeleteProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.setQueryData<Project[]>(projectKeys.all, (list) => list?.filter((p) => p.id !== id));
      qc.removeQueries({ queryKey: projectKeys.detail(id) });
    },
    onError: toastError,
  });
}

export function useUpdateMemberRole(projectId: string) {
  const qc = useQueryClient();
  const key = projectKeys.members(projectId);
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AssignableRole }) =>
      api<Member>(`/projects/${projectId}/members/${userId}`, {
        method: 'PATCH',
        ...json({ role }),
      }),
    // Optimistic: the select changes instantly and rolls back if the server refuses.
    onMutate: async ({ userId, role }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Member[]>(key);
      qc.setQueryData<Member[]>(key, (list) =>
        list?.map((m) => (m.id === userId ? { ...m, role } : m)),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      qc.setQueryData(key, ctx?.previous);
      toastError(err);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useRemoveMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<void>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.members(projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
    onError: toastError,
  });
}

/** Leaving is removing yourself; afterwards the project is no longer yours to see. */
export function useLeaveProject(projectId: string, myId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/projects/${projectId}/members/${myId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.setQueryData<Project[]>(projectKeys.all, (list) =>
        list?.filter((p) => p.id !== projectId),
      );
      qc.removeQueries({ queryKey: projectKeys.detail(projectId) });
    },
    onError: toastError,
  });
}

export function useCreateInvite(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInviteInput) =>
      api<CreatedInvite>(`/projects/${projectId}/invites`, { method: 'POST', ...json(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.invites(projectId) }),
    onError: toastError,
  });
}

export function useRevokeInvite(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api<void>(`/projects/${projectId}/invites/${inviteId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.invites(projectId) }),
    onError: toastError,
  });
}

export function useAcceptInvite(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ projectId: string }>(`/invites/${token}/accept`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}
