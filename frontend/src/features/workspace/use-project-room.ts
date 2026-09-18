import { projectDocName, type Me, type PresenceState, type ProjectEvent } from '@codecollab/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { presenceHex } from '@/components/ui/avatar';
import { openDocument } from '@/lib/collab';
import { projectKeys } from '../projects/api';
import { filesKey } from './files-api';

export interface Peer extends PresenceState {
  clientId: number;
  isMe: boolean;
}

/**
 * Joins the project's real-time room: publishes who I am and which file I'm on,
 * lists everyone else here, and reacts to server events (file tree changes).
 */
export function useProjectRoom(
  projectId: string,
  me: Me | undefined,
  activeFileId: string | null,
  onFileDeleted: (fileId: string) => void,
) {
  const qc = useQueryClient();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [connected, setConnected] = useState(false);
  const provider = useRef<ReturnType<typeof openDocument> | null>(null);
  const onDeleted = useRef(onFileDeleted);
  useEffect(() => {
    onDeleted.current = onFileDeleted;
  });

  useEffect(() => {
    if (!me) return;
    const p = openDocument(projectDocName(projectId), {
      onStatus: ({ status }) => setConnected(status === 'connected'),
      onStateless: ({ payload }) => {
        let event: ProjectEvent;
        try {
          event = JSON.parse(payload) as ProjectEvent;
        } catch {
          return;
        }
        if (event.type === 'files-changed') {
          void qc.invalidateQueries({ queryKey: filesKey(projectId) });
        } else if (event.type === 'file-deleted') {
          onDeleted.current(event.fileId);
        } else if (event.type === 'access-changed') {
          void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
        }
      },
      onAwarenessChange: ({ states }) => {
        const local = p.awareness?.clientID;
        setPeers(
          states
            .filter((s): s is typeof s & PresenceState => !!(s as Partial<PresenceState>).user)
            .map((s) => ({
              ...(s as PresenceState),
              clientId: s.clientId,
              isMe: s.clientId === local,
            })),
        );
      },
    });
    p.setAwarenessField('user', {
      id: me.id,
      name: me.username,
      color: presenceHex(me.id),
      avatarUrl: me.avatarUrl,
    } satisfies PresenceState['user']);
    provider.current = p;
    return () => {
      provider.current = null;
      p.destroy();
    };
  }, [projectId, me, qc]);

  useEffect(() => {
    provider.current?.setAwarenessField('fileId', activeFileId);
  }, [activeFileId, peers.length]);

  // The same person in two tabs shows up twice in awareness; show them once.
  const unique = [...new Map(peers.map((p) => [p.user.id, p])).values()];
  return { peers: unique, connected };
}
