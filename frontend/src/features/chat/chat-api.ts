import type { ChatMessage, MessagePage, Project, Reaction, Usage } from '@codecollab/shared';
import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { projectKeys, toastError } from '../projects/api';

type Thread = { root: ChatMessage; replies: ChatMessage[] };

export const chatKeys = {
  main: (projectId: string) => ['projects', projectId, 'messages'] as const,
  thread: (projectId: string, rootId: string) =>
    ['projects', projectId, 'messages', 'thread', rootId] as const,
};

/** Newest page first; each page's items are oldest-first. */
export const messagesQuery = (projectId: string) =>
  infiniteQueryOptions({
    queryKey: chatKeys.main(projectId),
    queryFn: ({ pageParam }) =>
      api<MessagePage>(`/projects/${projectId}/messages${pageParam ? `?before=${pageParam}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Live updates keep this fresh; don't refetch and lose scroll position.
    staleTime: Infinity,
  });

export const threadQuery = (projectId: string, rootId: string) =>
  queryOptions({
    queryKey: chatKeys.thread(projectId, rootId),
    queryFn: () => api<Thread>(`/projects/${projectId}/messages/${rootId}/thread`),
    staleTime: Infinity,
  });

/** All loaded main-channel messages, oldest first. */
export const flattenPages = (data: InfiniteData<MessagePage> | undefined) =>
  data ? [...data.pages].reverse().flatMap((p) => p.items) : [];

/** Insert or replace a message in every cache that holds it. */
export function upsertMessage(qc: QueryClient, message: ChatMessage) {
  const { projectId } = message;

  if (message.parentId === null) {
    qc.setQueryData<InfiniteData<MessagePage>>(chatKeys.main(projectId), (data) => {
      if (!data) return data;
      let found = false;
      const pages = data.pages.map((page) => ({
        ...page,
        items: page.items.map((m) => {
          if (m.id !== message.id) return m;
          found = true;
          return message;
        }),
      }));
      if (!found && pages[0]) pages[0] = { ...pages[0], items: [...pages[0].items, message] };
      return { ...data, pages };
    });
    qc.setQueryData<Thread>(chatKeys.thread(projectId, message.id), (t) =>
      t ? { ...t, root: message } : t,
    );
  } else {
    qc.setQueryData<Thread>(chatKeys.thread(projectId, message.parentId), (t) => {
      if (!t) return t;
      const exists = t.replies.some((r) => r.id === message.id);
      return {
        ...t,
        replies: exists
          ? t.replies.map((r) => (r.id === message.id ? message : r))
          : [...t.replies, message],
      };
    });
  }
}

/** Adjust the unread badge held on the project itself. */
export function setUnread(qc: QueryClient, projectId: string, update: (n: number) => number) {
  const apply = (p: Project) => ({ ...p, unreadCount: Math.max(0, update(p.unreadCount)) });
  qc.setQueryData<Project>(projectKeys.detail(projectId), (p) => (p ? apply(p) : p));
  qc.setQueryData<Project[]>(projectKeys.all, (list) =>
    list?.map((p) => (p.id === projectId ? apply(p) : p)),
  );
}

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export function useSendMessage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      content: string;
      parentId: string | null;
      clientId: string;
      context?: { activeFileId: string | null };
    }) => api<ChatMessage>(`/projects/${projectId}/messages`, { method: 'POST', ...json(input) }),
    onSuccess: (message) => upsertMessage(qc, message),
  });
}

export function useEditMessage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api<ChatMessage>(`/projects/${projectId}/messages/${id}`, {
        method: 'PATCH',
        ...json({ content }),
      }),
    onSuccess: (message) => upsertMessage(qc, message),
    onError: toastError,
  });
}

export function useDeleteMessage(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<ChatMessage>(`/projects/${projectId}/messages/${id}`, { method: 'DELETE' }),
    onSuccess: (message) => upsertMessage(qc, message),
    onError: toastError,
  });
}

export function useReact(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: Reaction }) =>
      api<ChatMessage>(`/projects/${projectId}/messages/${id}/reactions`, {
        method: 'POST',
        ...json({ emoji }),
      }),
    onSuccess: (message) => upsertMessage(qc, message),
    onError: toastError,
  });
}

export function useMarkRead(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/projects/${projectId}/messages/read`, { method: 'POST' }),
    onMutate: () => setUnread(qc, projectId, () => 0),
  });
}

// ---------- AI ----------

export const usageQuery = queryOptions({
  queryKey: ['me', 'usage'],
  queryFn: () => api<Usage>('/users/me/usage'),
  staleTime: 60_000,
});

/** Append streamed text to an AI answer that's still being written. */
export function appendAiDelta(
  qc: QueryClient,
  projectId: string,
  event: { messageId: string; parentId: string | null; delta: string },
) {
  const add = (m: ChatMessage) =>
    m.id === event.messageId ? { ...m, content: m.content + event.delta } : m;
  if (event.parentId === null) {
    qc.setQueryData<InfiniteData<MessagePage>>(chatKeys.main(projectId), (data) =>
      data ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map(add) })) } : data,
    );
  } else {
    qc.setQueryData<Thread>(chatKeys.thread(projectId, event.parentId), (t) =>
      t ? { ...t, replies: t.replies.map(add) } : t,
    );
  }
}

export function useStopAi(projectId: string) {
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/projects/${projectId}/messages/${id}/ai/stop`, { method: 'POST' }),
    onError: toastError,
  });
}

export function useDecideProposal(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'apply' | 'reject' }) =>
      api<ChatMessage>(`/projects/${projectId}/messages/${id}/proposal/${decision}`, {
        method: 'POST',
      }),
    onSuccess: (message) => upsertMessage(qc, message),
    onError: toastError,
  });
}
