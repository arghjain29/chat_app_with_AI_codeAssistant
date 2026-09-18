import type { Me } from '@codecollab/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: () => api<Me>('/users/me'),
});

export const useMe = () => useQuery(meQuery);
