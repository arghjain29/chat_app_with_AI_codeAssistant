import type { CreateFileInput, FileEntry, FileSnapshot } from '@codecollab/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toastError } from '../projects/api';

export const filesKey = (projectId: string) => ['projects', projectId, 'files'] as const;

export const filesQuery = (projectId: string) =>
  queryOptions({
    queryKey: filesKey(projectId),
    queryFn: () => api<FileEntry[]>(`/projects/${projectId}/files`),
  });

export const fetchSnapshot = (projectId: string) =>
  api<FileSnapshot[]>(`/projects/${projectId}/files/snapshot`);

const json = (body: unknown) => ({ body: JSON.stringify(body) });

export function useCreateFile(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFileInput) =>
      api<FileEntry>(`/projects/${projectId}/files`, { method: 'POST', ...json(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: filesKey(projectId) }),
  });
}

export function useMoveFile(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) =>
      api<FileEntry>(`/projects/${projectId}/files/${id}`, { method: 'PATCH', ...json({ path }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: filesKey(projectId) }),
  });
}

export function useDeleteFile(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/projects/${projectId}/files/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: filesKey(projectId) }),
    onError: toastError,
  });
}
