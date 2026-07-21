// Pure helper for composing a `ConditionStats` (or `null`, meaning "no
// condition defined") into a localized sentence, e.g. "4 kills with 1
// generator(s) remaining". No Astro dependency, so this is easy to
// unit-test in isolation — the `t` lookup function is injected rather than
// pulled from `Astro.locals.t` directly.
import type { ConditionStats } from './types';

type ConditionKey =
  | 'matchConditions.none'
  | 'matchConditions.kills'
  | 'matchConditions.gensRemaining'
  | 'matchConditions.hookStages';

type Translate = (key: ConditionKey) => string;

/** Compose a ConditionStats (or null) into a localized sentence by looking up
 * per-stat phrase templates via `t` and joining the ones present. */
export function describeConditionStats(stats: ConditionStats | null, t: Translate): string {
  if (!stats) return t('matchConditions.none');

  const parts: string[] = [];
  if (stats.kills != null) parts.push(t('matchConditions.kills').replace('{n}', String(stats.kills)));
  if (stats.gensRemaining != null)
    parts.push(t('matchConditions.gensRemaining').replace('{n}', String(stats.gensRemaining)));
  if (stats.hookStages != null)
    parts.push(t('matchConditions.hookStages').replace('{n}', String(stats.hookStages)));

  return parts.length > 0 ? parts.join(' ') : t('matchConditions.none');
}
