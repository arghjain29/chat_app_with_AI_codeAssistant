import { PLANS, type AiMeta } from '@codecollab/shared';
import type { Types } from 'mongoose';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { liveFileText, notifyProject } from '../realtime/collab.js';
import { broadcast } from '../modules/chat/chat.service.js';
import { MessageModel, type MessageDoc } from '../modules/chat/message.model.js';
import { FileModel } from '../modules/files/file.model.js';
import { textFromState } from '../modules/files/yjs.js';
import type { ProjectAccess } from '../modules/projects/access.js';
import { UserModel, type UserDoc } from '../modules/users/user.model.js';
import { releaseAiSlot } from './guard.js';
import { costMicros, modelsFor, type ModelChoice } from './models.js';
import { buildPrompt, SYSTEM_PROMPT } from './prompt.js';
import { buildProposal } from './proposal.js';
import { ProviderError, type AiResult } from './providers.js';
import { recordSpend, refundAiRequest } from './usage.js';

/** Answers being generated right now, so they can be stopped. */
const running = new Map<string, { controller: AbortController; requestedBy: string }>();

const DELTA_FLUSH_MS = 60;

async function conversationFor(trigger: MessageDoc) {
  const history = await MessageModel.find({
    projectId: trigger.projectId,
    parentId: trigger.parentId,
    deletedAt: null,
    _id: { $lte: trigger._id },
  })
    .sort({ _id: -1 })
    .limit(20);
  const authors = await UserModel.find(
    { _id: { $in: history.map((m) => m.authorId).filter(Boolean) } },
    { username: 1 },
  );
  const names = new Map(authors.map((a) => [a.id as string, a.username]));
  return history.reverse().map((m) => ({
    author: m.kind === 'ai' ? 'AI assistant' : (names.get(String(m.authorId)) ?? 'someone'),
    content: m.content,
  }));
}

async function openFileFor(projectId: Types.ObjectId, fileId: string | null | undefined) {
  if (!fileId) return null;
  const file = await FileModel.findOne({ _id: fileId, projectId, kind: 'file' }).select(
    '+yjsState',
  );
  if (!file) return null;
  return { path: file.path, content: liveFileText(file.id) ?? textFromState(file.yjsState) };
}

/**
 * Reply to an `@ai` message. Runs in the background: the answer streams to everyone in
 * the project and is saved when done. The caller has already passed `authorizeAiRequest`.
 */
export function startAssistant(input: {
  access: ProjectAccess;
  user: UserDoc;
  trigger: MessageDoc;
  activeFileId?: string | null;
}) {
  void run(input).catch((err) => logger.error({ err }, 'AI assistant crashed'));
}

async function run({ access, user, trigger, activeFileId }: Parameters<typeof startAssistant>[0]) {
  const projectId = access.project._id;
  const projectKey = String(projectId);
  const tier = PLANS[user.plan].limits.modelTiers.includes('premium') ? 'premium' : 'fast';

  const answer = await MessageModel.create({
    projectId,
    kind: 'ai',
    authorId: null,
    content: '',
    parentId: trigger.parentId,
    ai: { status: 'streaming', model: null, requestedBy: user._id, proposal: null } satisfies Omit<
      AiMeta,
      'requestedBy'
    > & { requestedBy: Types.ObjectId },
  });
  await broadcast(answer);

  const controller = new AbortController();
  running.set(answer.id, { controller, requestedBy: user.id as string });

  let content = '';
  let pending = '';
  let flushTimer: NodeJS.Timeout | null = null;
  const flush = () => {
    flushTimer = null;
    if (!pending) return;
    notifyProject(projectKey, {
      type: 'ai-delta',
      messageId: answer.id,
      parentId: answer.parentId ? String(answer.parentId) : null,
      delta: pending,
    });
    pending = '';
  };
  const onText = (delta: string) => {
    content += delta;
    pending += delta;
    flushTimer ??= setTimeout(flush, DELTA_FLUSH_MS);
  };

  let used: ModelChoice | null = null;
  let result: AiResult | null = null;
  let failure: string | null = null;

  try {
    const [files, openFile, conversation] = await Promise.all([
      FileModel.find({ projectId, kind: 'file' }, { path: 1 }).sort({ path: 1 }),
      openFileFor(projectId, activeFileId),
      conversationFor(trigger),
    ]);
    const prompt = buildPrompt({
      plan: user.plan,
      filePaths: files.map((f) => f.path),
      openFile,
      conversation,
    });

    // Try each model in order. Fall back only if nothing was streamed yet: switching
    // models mid-answer would leave a confusing half-and-half reply.
    for (const choice of modelsFor(tier)) {
      try {
        result = await choice.provider.stream({
          model: choice.model,
          system: SYSTEM_PROMPT,
          prompt,
          signal: controller.signal,
          onText,
        });
        used = choice;
        break;
      } catch (err) {
        if (controller.signal.aborted) break;
        logger.warn({ err: (err as Error).message, model: choice.model }, 'AI model failed');
        if (content || !(err instanceof ProviderError && err.retryable)) {
          failure = (err as Error).message;
          break;
        }
      }
    }
    if (!used && !controller.signal.aborted) failure ??= 'no model could answer';
  } catch (err) {
    failure = (err as Error).message;
    logger.error({ err }, 'AI answer failed');
  } finally {
    if (flushTimer) clearTimeout(flushTimer);
    flush();
    running.delete(answer.id);
    releaseAiSlot(user.id as string, projectKey);
  }

  // ---- Save the outcome ----
  const stopped = controller.signal.aborted;
  let proposal = null;
  if (used && result?.toolInput) {
    const built = await buildProposal(projectId, result.toolInput);
    proposal = built.proposal;
    if (built.skipped.length) {
      content += `\n\n_Some suggested changes were left out: ${built.skipped.join('; ')}._`;
    }
  }
  if (used && result) {
    await recordSpend(user._id, user.plan, {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costMicros: costMicros(used, result.inputTokens, result.outputTokens),
    });
  }
  if (!used && !content) {
    // Nothing was produced: don't charge the person's quota for it.
    await refundAiRequest(user._id, user.plan);
  }

  answer.content =
    content ||
    (proposal ? proposal.summary : '') ||
    (stopped
      ? '_Stopped before answering._'
      : failure
        ? 'I couldn’t answer right now: the AI service is busy or unavailable. Try again in a moment.'
        : '_No answer._');
  answer.ai = {
    status: stopped ? 'stopped' : failure && !used ? 'error' : 'done',
    model: used?.label ?? null,
    requestedBy: user._id,
    proposal,
  };
  answer.markModified('ai');
  await answer.save();
  await broadcast(answer);
}

/** Stop an answer that's still being written: the person who asked, or the owner. */
export async function stopAssistant(access: ProjectAccess, messageId: string) {
  const entry = running.get(messageId);
  if (!entry) throw new NotFoundError('Running answer');
  const userId = String(access.membership.userId);
  if (entry.requestedBy !== userId && access.membership.role !== 'owner') {
    throw new ForbiddenError('Only the person who asked, or the owner, can stop this answer.');
  }
  entry.controller.abort();
}
