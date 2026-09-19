/**
 * Provider adapters. Each one streams a single answer through its official SDK and
 * reports text as it arrives, an optional propose_changes call, and token usage.
 */
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { PROPOSE_CHANGES_TOOL } from '@codecollab/shared';

export interface AiRequest {
  model: string;
  system: string;
  prompt: string;
  signal: AbortSignal;
  onText: (delta: string) => void;
}

export interface AiResult {
  /** Raw propose_changes arguments, unvalidated. */
  toolInput: unknown | null;
  inputTokens: number;
  outputTokens: number;
}

export interface Provider {
  id: 'gemini' | 'anthropic';
  stream(req: AiRequest): Promise<AiResult>;
}

/** Thrown for failures worth retrying on another model (overloaded, rate limited, etc.). */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

const statusOf = (err: unknown) =>
  (err as { status?: number; code?: number }).status ?? (err as { code?: number }).code;

const retryableStatus = (status: number | undefined) =>
  status === undefined || status === 408 || status === 429 || status >= 500 || status === 404;

export function geminiProvider(apiKey: string): Provider {
  const ai = new GoogleGenAI({ apiKey });
  return {
    id: 'gemini',
    async stream({ model, system, prompt, signal, onText }) {
      let toolInput: unknown = null;
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        const stream = await ai.models.generateContentStream({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            systemInstruction: system,
            abortSignal: signal,
            maxOutputTokens: 16_000,
            tools: [
              {
                functionDeclarations: [
                  {
                    name: PROPOSE_CHANGES_TOOL.name,
                    description: PROPOSE_CHANGES_TOOL.description,
                    parametersJsonSchema: PROPOSE_CHANGES_TOOL.parameters,
                  },
                ],
              },
            ],
          },
        });
        for await (const chunk of stream) {
          // Read text parts directly: the `.text` shortcut warns when a chunk also has a call.
          for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
            if (part.text && !part.thought) onText(part.text);
          }
          const call = chunk.functionCalls?.find((c) => c.name === PROPOSE_CHANGES_TOOL.name);
          if (call) toolInput = call.args ?? null;
          if (chunk.usageMetadata) {
            inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
            outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
          }
        }
      } catch (err) {
        if (signal.aborted) throw err;
        const status = statusOf(err);
        throw new ProviderError(
          `Gemini ${model} failed${status ? ` (${status})` : ''}`,
          retryableStatus(status),
        );
      }
      return { toolInput, inputTokens, outputTokens };
    },
  };
}

export function anthropicProvider(apiKey: string): Provider {
  const client = new Anthropic({ apiKey });
  return {
    id: 'anthropic',
    async stream({ model, system, prompt, signal, onText }) {
      try {
        const stream = client.messages.stream(
          {
            model,
            max_tokens: 16_000,
            system,
            messages: [{ role: 'user', content: prompt }],
            tools: [
              {
                name: PROPOSE_CHANGES_TOOL.name,
                description: PROPOSE_CHANGES_TOOL.description,
                input_schema:
                  PROPOSE_CHANGES_TOOL.parameters as unknown as Anthropic.Tool.InputSchema,
              },
            ],
          },
          { signal },
        );
        stream.on('text', (delta) => onText(delta));
        const message = await stream.finalMessage();
        if (message.stop_reason === 'refusal') {
          onText('\n\nI can’t help with that request.');
        }
        const toolUse = message.content.find(
          (b): b is Anthropic.ToolUseBlock =>
            b.type === 'tool_use' && b.name === PROPOSE_CHANGES_TOOL.name,
        );
        return {
          // A truncated (max_tokens) tool call is incomplete: don't propose half a file.
          toolInput: message.stop_reason === 'max_tokens' ? null : (toolUse?.input ?? null),
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        };
      } catch (err) {
        if (signal.aborted) throw err;
        if (err instanceof Anthropic.APIError) {
          throw new ProviderError(
            `Claude ${model} failed (${err.status ?? 'network'})`,
            retryableStatus(err.status),
          );
        }
        throw err;
      }
    },
  };
}
