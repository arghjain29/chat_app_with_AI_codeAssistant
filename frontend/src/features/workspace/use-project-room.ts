import {
  projectDocName,
  type ChatMessage,
  type Me,
  type PresenceState,
  type ProjectEvent,
} from '@codecollab/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { presenceHex } from '@/components/ui/avatar';
import { openDocument } from '@/lib/collab';
import { projectKeys } from '../projects/api';
import { filesKey } from './files-api';

export interface Peer extends PresenceState {
  clientId: number;
  isMe: boolean;
}

export interface RoomHandlers {
  onFileDeleted: (fileId: string) => void;
  onMessage: (message: ChatMessage) => void;
  onAiDelta: (event: { messageId: string; parentId: string | null; delta: string }) => void;
}

/**
 * Joins the project's real-time room: publishes who I am, which file I'm on and whether
 * I'm typing; lists everyone else here; and passes server events (file tree changes,
 * chat messages) to the handlers.
 */
export function useProjectRoom(
  projectId: string,
  me: Me | undefined,
  activeFileId: string | null,
  handlers: RoomHandlers,
) {
  const qc = useQueryClient();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [connected, setConnected] = useState(false);
  const provider = useRef<ReturnType<typeof openDocument> | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const meId = me?.id;
  const meName = me?.username;
  const meAvatar = me?.avatarUrl ?? null;

  useEffect(() => {
    if (!meId || !meName) return;
    const p = openDocument(projectDocName(projectId), {
      onStatus: ({ status }) => setConnected(status === 'connected'),
      onStateless: ({ payload }) => {
        let event: ProjectEvent;
        try {
          event = JSON.parse(payload) as ProjectEvent;
        } catch {
          return;
        }
        switch (event.type) {
          case 'files-changed':
            void qc.invalidateQueries({ queryKey: filesKey(projectId) });
            break;
          case 'file-deleted':
            handlersRef.current.onFileDeleted(event.fileId);
            break;
          case 'access-changed':
            void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
            break;
          case 'message':
            handlersRef.current.onMessage(event.message);
            break;
          case 'ai-delta':
            handlersRef.current.onAiDelta(event);
            break;
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
      id: meId,
      name: meName,
      color: presenceHex(meId),
      avatarUrl: meAvatar,
    } satisfies PresenceState['user']);
    provider.current = p;
    return () => {
      provider.current = null;
      p.destroy();
    };
  }, [projectId, meId, meName, meAvatar, qc]);

  useEffect(() => {
    provider.current?.setAwarenessField('fileId', activeFileId);
  }, [activeFileId, peers.length]);

  /** Announce that I'm typing in the main chat or a thread (`null` to stop). */
  const setTyping = useCallback((where: string | null) => {
    provider.current?.setAwarenessField(
      'typing',
      where ? ({ in: where, at: Date.now() } satisfies PresenceState['typing']) : null,
    );
  }, []);

  // The same person in two tabs shows up twice in awareness; show them once.
  const unique = [...new Map(peers.map((p) => [p.user.id, p])).values()];
  return { peers: unique, connected, setTyping };
}
