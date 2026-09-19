import type { ModelTier } from '@codecollab/shared';
import { env } from '../env.js';
import { anthropicProvider, geminiProvider, type Provider } from './providers.js';

export interface ModelChoice {
  provider: Provider;
  model: string;
  label: string;
  /** Estimated USD per million tokens, used for the daily spending ceiling. */
  price: { input: number; output: number };
}

/**
 * Rough prices for the spending ceiling. They only need to be in the right ballpark:
 * the ceiling is a safety net, not billing. Unknown models use the fallback.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  'gemini-3.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-3.8-flash': { input: 0.3, output: 2.5 },
  'gemini-3.1-pro-preview': { input: 2, output: 12 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 2, output: 10 },
};
const FALLBACK_PRICE = { input: 3, output: 15 };

const label = (model: string) =>
  model
    .replace(/-preview$/, '')
    .split('-')
    .map((p) => (/^\d/.test(p) ? p : p[0]!.toUpperCase() + p.slice(1)))
    .join(' ')
    .replace('Flash Lite', 'Flash-Lite');

/** "gemini:gemini-3.8-flash,anthropic:claude-haiku-4-5" -> ordered [provider, model] pairs. */
const parseList = (raw: string) =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [provider, ...rest] = entry.split(':');
      return { provider: provider!, model: rest.join(':') };
    });

let providers: Partial<Record<Provider['id'], Provider>> | null = null;
const configuredProviders = () => {
  providers ??= {
    ...(env.GEMINI_API_KEY ? { gemini: geminiProvider(env.GEMINI_API_KEY) } : {}),
    ...(env.ANTHROPIC_API_KEY ? { anthropic: anthropicProvider(env.ANTHROPIC_API_KEY) } : {}),
  };
  return providers;
};

/** Tests swap in a fake provider. */
export function setProvidersForTesting(fake: Partial<Record<Provider['id'], Provider>> | null) {
  providers = fake;
}

/**
 * Models to try for a plan tier, best first. Entries whose provider has no API key are
 * skipped, so a single Gemini key is enough to run everything.
 */
export function modelsFor(tier: ModelTier): ModelChoice[] {
  const available = configuredProviders();
  const list = parseList(tier === 'premium' ? env.AI_PREMIUM_MODELS : env.AI_FAST_MODELS);
  return list.flatMap(({ provider, model }) => {
    const p = available[provider as Provider['id']];
    return p
      ? [{ provider: p, model, label: label(model), price: PRICES[model] ?? FALLBACK_PRICE }]
      : [];
  });
}

export const aiConfigured = () => Object.keys(configuredProviders()).length > 0;

/** Cost in millionths of a dollar. */
export const costMicros = (choice: ModelChoice, inputTokens: number, outputTokens: number) =>
  Math.ceil(inputTokens * choice.price.input + outputTokens * choice.price.output);
