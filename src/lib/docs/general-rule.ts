// Pure, dependency-free lookup from a balancing record's `format:` value to
// the general-rule docs page it falls under, plus the i18n key for that
// rule's link label.
//
// Deliberately free of any `astro:content` (or other Astro) import, for the
// same reason documented at the top of ./ids: this module is imported both
// from Astro components AND directly by scripts/check-translations.mjs via
// plain Node. Pulling in an Astro-only import here would make that script
// un-runnable outside the Astro content pipeline.

export type GeneralRuleLabelKey =
  | 'balancingIntro.generalRule.1v4'
  | 'balancingIntro.generalRule.1v1Symmetric';

export interface GeneralRuleTarget {
  /** Locale-independent docs id — feed to idToHref() with the route's locale. */
  readonly id: string;
  readonly labelKey: GeneralRuleLabelKey;
}

const RULE_1V4: GeneralRuleTarget = {
  id: 'game-modes/reference/1v4-general-rule',
  labelKey: 'balancingIntro.generalRule.1v4',
};
const RULE_1V1_SYMMETRIC: GeneralRuleTarget = {
  id: 'game-modes/1v1-symmetric/rules/general',
  labelKey: 'balancingIntro.generalRule.1v1Symmetric',
};

// Keys are the literal `format:` strings in use today. Note the 1v1 pages
// declare `1v1-symmetric-rank`, not `1v1-symmetric`.
//
// A `Map` (not an object literal) is deliberate: this project does not
// enable `noUncheckedIndexedAccess`, so an object index signature would type
// every lookup as always-present and defeat the caller's `undefined` guard
// on an unrecognized format. `Map.get()` correctly types as
// `GeneralRuleTarget | undefined`.
export const GENERAL_RULE_BY_FORMAT: ReadonlyMap<string, GeneralRuleTarget> = new Map([
  ['1v4-quartet', RULE_1V4],
  ['1v4-duo', RULE_1V4],
  ['1v1-symmetric-rank', RULE_1V1_SYMMETRIC],
]);

export const KNOWN_BALANCING_FORMATS: readonly string[] = [...GENERAL_RULE_BY_FORMAT.keys()];
