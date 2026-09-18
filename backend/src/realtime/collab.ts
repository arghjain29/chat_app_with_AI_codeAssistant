import type { IncomingMessage, Server } from 'node:http';
import {
  FILE_LIMITS,
  FILE_TEXT_KEY,
  fileDocName,
  parseDocName,
  projectDocName,
  type ProjectEvent,
  type Role,
} from '@codecollab/shared';
import { Hocuspocus } from '@hocuspocus/server';
import * as Y from 'yjs';
import { WebSocketServer } from 'ws';
import { env } from '../env.js';
import { verifySessionToken } from '../lib/clerk.js';
import { logger } from '../lib/logger.js';
import { FileModel } from '../modules/files/file.model.js';
import { MembershipModel } from '../modules/projects/membership.model.js';
import { findOrCreateUserByClerkId } from '../modules/users/user.service.js';

export const COLLAB_PATH = '/collab';

export interface CollabContext {
  userId: string;
  projectId: string;
  role: Role;
}

/**
 * Real-time collaboration server (Yjs over WebSocket).
 *
 * - `file:<id>` documents hold one file's text. Viewers connect read-only.
 * - `project:<id>` documents carry presence (who is here, which file) and
 *   server events such as "the file tree changed". Nobody can write to them.
 */
export const collab = new Hocuspocus<CollabContext>({
  name: 'codecollab',
  quiet: true,
  // Persist a couple of seconds after typing stops, and at least every 10s while it continues.
  debounce: 2_000,
  maxDebounce: 10_000,

  async onAuthenticate({ token, documentName, connectionConfig }) {
    const doc = parseDocName(documentName);
    if (!doc) throw new Error('Unknown document');

    const clerkId = await verifySessionToken(token);
    if (!clerkId) throw new Error('Not signed in');
    const user = await findOrCreateUserByClerkId(clerkId);

    const projectId =
      doc.kind === 'project'
        ? doc.id
        : (await FileModel.findOne({ _id: doc.id, kind: 'file' }, { projectId: 1 }))?.projectId;
    if (!projectId) throw new Error('Not found');

    const membership = await MembershipModel.findOne({ projectId, userId: user._id });
    if (!membership) throw new Error('Not found');

    if (doc.kind === 'project' || membership.role === 'viewer') {
      connectionConfig.readOnly = true;
    }
    return { userId: user.id as string, projectId: String(projectId), role: membership.role };
  },

  async onLoadDocument({ documentName, document }) {
    const doc = parseDocName(documentName);
    if (doc?.kind !== 'file') return document;
    const file = await FileModel.findById(doc.id).select('+yjsState');
    if (file?.yjsState?.length) Y.applyUpdate(document, file.yjsState);
    return document;
  },

  async onStoreDocument({ documentName, document, lastContext }) {
    const doc = parseDocName(documentName);
    if (doc?.kind !== 'file') return;
    const text = document.getText(FILE_TEXT_KEY).toString();
    // If the file was deleted meanwhile this matches nothing, which is what we want.
    await FileModel.updateOne(
      { _id: doc.id },
      {
        yjsState: Buffer.from(Y.encodeStateAsUpdate(document)),
        size: Buffer.byteLength(text),
        ...(lastContext?.userId ? { updatedBy: lastContext.userId } : {}),
      },
    );
  },
});

/** Tell everyone viewing a project that something changed (e.g. the file tree). */
export function notifyProject(projectId: string, event: ProjectEvent) {
  collab.documents.get(projectDocName(projectId))?.broadcastStateless(JSON.stringify(event));
}

/** Live text of a file if someone has it open, otherwise null. */
export function liveFileText(fileId: string): string | null {
  return collab.documents.get(fileDocName(fileId))?.getText(FILE_TEXT_KEY).toString() ?? null;
}

/** Disconnect everyone from a file's document, e.g. after it is deleted. */
export function closeFileDocument(fileId: string) {
  collab.closeConnections(fileDocName(fileId));
}

/**
 * Drop a user's live connections in a project, e.g. after they're removed or their role
 * changes. Providers reconnect on their own and re-authenticate with the new rights.
 */
export function disconnectUser(projectId: string, userId: string) {
  for (const document of collab.documents.values()) {
    for (const connection of document.connections.keys()) {
      const ctx = connection.context;
      if (ctx?.projectId === projectId && ctx.userId === userId) connection.close();
    }
  }
}

/** Convert Node's upgrade request to the web-standard Request Hocuspocus v4 expects. */
function toWebRequest(req: IncomingMessage): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, { headers });
}

/** Hocuspocus protocol keep-alive messages (MessageType.Ping / MessageType.Pong). */
const PING = new Uint8Array([9]);
const PONG = 10;
const KEEPALIVE_MS = 15_000;

/** Exact origins (scheme + host + port) of the frontend, e.g. `https://app.example.com`. */
const allowedOrigins = new Set(
  env.FRONTEND_URL.flatMap((u) => {
    try {
      return [new URL(u).origin];
    } catch {
      return [];
    }
  }),
);

/** Accept collaboration WebSockets on `COLLAB_PATH` of the existing HTTP server. */
export function attachCollab(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: FILE_LIMITS.maxFileBytes * 2 });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname !== COLLAB_PATH) return; // Other upgrade handlers (e.g. Socket.io) may claim it.

    // Browsers always send Origin: only our own frontend may connect. (Non-browser clients
    // send none; they still need a valid session token, which is sent explicitly, not by cookie.)
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      // Hocuspocus v4 doesn't listen to the socket itself: forward messages and close events.
      const connection = collab.handleConnection(ws, toWebRequest(req));

      // Clients drop a connection after 30s without hearing from the server, so ping idle
      // ones. (Their pong replies aren't document data: don't hand them to Hocuspocus.)
      const keepAlive = setInterval(() => {
        if (ws.readyState === ws.OPEN) ws.send(PING);
      }, KEEPALIVE_MS);

      ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
        const bytes = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
        if (bytes.length === 1 && bytes[0] === PONG) return;
        connection.handleMessage(new Uint8Array(bytes));
      });
      ws.on('close', (code, reason) => {
        clearInterval(keepAlive);
        connection.handleClose({ code, reason: reason.toString() });
      });
      ws.on('error', (err) => logger.warn({ err: err.message }, 'Collaboration socket error'));
    });
  });

  logger.info(`Collaboration server ready on ${COLLAB_PATH}`);
  return {
    /** Save everything still waiting to be written, then close connections. */
    async close() {
      collab.flushPendingStores();
      collab.closeConnections();
      wss.close();
    },
  };
}
