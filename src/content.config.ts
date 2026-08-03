import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

// The content drafts (see ../../drafts/README.md) carry lifecycle and record
// metadata beyond Starlight's built-in frontmatter. We extend the docs schema so
// those custom keys validate. They are all OPTIONAL for the skeleton; tightening
// required normative metadata (per UX §5.3) belongs to the full wiring step.
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        // Lifecycle metadata on normative game mode / policy pages.
        status: z.enum(['active', 'upcoming', 'archived', 'provisional']).optional(),
        version: z.string().optional(),
        effectiveDate: z.string().optional(),
        changeHistory: z
          .array(
            z.object({
              version: z.string(),
              date: z.string(),
              note: z.string(),
            }),
          )
          .optional(),
        // Record identity / classification.
        handle: z.string().optional(),
        killer: z.string().optional(),
        format: z.string().optional(),
        // Translation provenance. English remains the authoritative edition;
        // localized pages record which English version they cover. `language`
        // and `authoritativeSource` are DERIVED (from the content id's locale
        // segment and path respectively — see UX §6); they stay declared here
        // for type-checking, but authors must not set them in frontmatter —
        // that is enforced at build time by
        // `assertNoAuthoritativeOverrides()` in `src/lib/docs/lifecycle.ts`,
        // not by this schema (Zod silently strips unknown keys rather than
        // erroring, so removing them here would not catch a reintroduction).
        language: z.string().optional(),
        translationStatus: z.enum(['complete', 'incomplete', 'outdated']).optional(),
        translatedVersion: z.string().optional(),
        translationDate: z.string().optional(),
        authoritativeSource: z.string().optional(),
        // Notice classification.
        type: z.string().optional(),
        date: z.string().optional(),
      }).superRefine((data, ctx) => {
        const hasStatus = data.status !== undefined;
        const hasChangeHistory = (data.changeHistory?.length ?? 0) > 0;

        // Rule 1 (UX §5.3): lifecycle metadata is all-or-nothing.
        if (hasStatus && !hasChangeHistory) {
          ctx.addIssue({
            code: 'custom',
            path: ['changeHistory'],
            message:
              '`status` is present, so `changeHistory` must be a non-empty array; add at least one entry.',
          });
        }
        // NOTE: the converse ("changeHistory implies status") is deliberately
        // NOT enforced here. A localized page may carry `changeHistory` as a
        // notes-only override — translated `note` prose over the English
        // version/date lineage — while `status` is forbidden on it because it
        // is derived. A Zod refinement only sees the parsed frontmatter, never
        // the entry id, so it cannot tell a localized page from an English one.
        // "English lifecycle pages need a status" is checked instead by
        // scripts/check-translations.mjs (check D), which does know the path.

        // Rule 2 (UX §5.3): version/effectiveDate are derived from the newest
        // changeHistory entry on lifecycle pages, not declared directly.
        // Non-lifecycle records (e.g. notices) may still carry a bare `version`.
        if (hasStatus && data.version !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['version'],
            message:
              '`version` is derived from the newest `changeHistory` entry; remove it.',
          });
        }
        if (hasStatus && data.effectiveDate !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['effectiveDate'],
            message:
              '`effectiveDate` is derived from the newest `changeHistory` entry; remove it.',
          });
        }

        // Rule 3 (UX §6): translation provenance requires a date.
        if (data.translationStatus !== undefined && data.translationDate === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['translationDate'],
            message: '`translationStatus` is present, so `translationDate` is required; add a `translationDate` value.',
          });
        }

        // Rule 4 (UX §6): a complete translation covers the current English
        // version by definition, so `translatedVersion` is derived, not declared.
        if (data.translationStatus === 'complete' && data.translatedVersion !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['translatedVersion'],
            message:
              '`translationStatus: complete` implies the current English version; remove `translatedVersion` (it is derived).',
          });
        }

        // Rule 5 (UX §6): outdated/incomplete translations cover a version that
        // genuinely differs from English and cannot be derived, so it must be shown.
        if (
          (data.translationStatus === 'outdated' || data.translationStatus === 'incomplete') &&
          data.translatedVersion === undefined
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['translatedVersion'],
            message:
              '`translationStatus: outdated`/`incomplete` must carry `translatedVersion` (UX §6); add the English version this translation covers.',
          });
        }
      }),
    }),
  }),
  // Localized UI strings for custom components (StatusBadge, LifecycleMeta,
  // MatchConditions, BalancingIntro). Built-in Starlight UI strings are translated
  // automatically per locale; these custom keys are read via Astro.locals.t(). Files
  // live in src/content/i18n/.
  i18n: defineCollection({
    loader: i18nLoader(),
    schema: i18nSchema({
      extend: z.object({
        'status.active': z.string().optional(),
        'status.active.title': z.string().optional(),
        'status.upcoming': z.string().optional(),
        'status.upcoming.title': z.string().optional(),
        'status.archived': z.string().optional(),
        'status.archived.title': z.string().optional(),
        'status.provisional': z.string().optional(),
        'status.provisional.title': z.string().optional(),
        'lifecycle.status': z.string().optional(),
        'lifecycle.version': z.string().optional(),
        'lifecycle.effectiveDate': z.string().optional(),
        'lifecycle.changeHistory': z.string().optional(),
        'killerPool.available': z.string().optional(),
        'killerPool.upcoming': z.string().optional(),
        'killerPool.undecided': z.string().optional(),
        'killerPool.unsupported': z.string().optional(),
        'matchConditions.aspect': z.string().optional(),
        'matchConditions.detail': z.string().optional(),
        'matchConditions.map': z.string().optional(),
        'matchConditions.winCondition': z.string().optional(),
        'matchConditions.drawCondition': z.string().optional(),
        'matchConditions.none': z.string().optional(),
        'matchConditions.kills': z.string().optional(),
        'matchConditions.gensRemaining': z.string().optional(),
        'matchConditions.hookStages': z.string().optional(),
        'balancingList.allowed': z.string().optional(),
        'balancingList.banned': z.string().optional(),
        'balancingList.itemBanned': z.string().optional(),
        'balancingList.none': z.string().optional(),
        'balancingList.addons': z.string().optional(),
        'balancingList.addonsUpToN': z.string().optional(),
        'balancingList.addonsPlain': z.string().optional(),
        'balancingList.itemDuplicateLimit.team.max1': z.string().optional(),
        'balancingList.itemDuplicateLimit.team.maxN': z.string().optional(),
        'balancingList.itemDuplicateLimit.duo.max1': z.string().optional(),
        'balancingList.itemDuplicateLimit.duo.maxN': z.string().optional(),
        'requiredOfferings.killer': z.string().optional(),
        'requiredOfferings.survivor': z.string().optional(),
        'balancingIntro.subject': z.string().optional(),
        'balancingIntro.relation': z.string().optional(),
        'balancingIntro.generalRule.1v4': z.string().optional(),
        'balancingIntro.generalRule.1v1Symmetric': z.string().optional(),
        'balancingOverview.killer': z.string().optional(),
        'balancingOverview.status': z.string().optional(),
        'translation.notice.label': z.string().optional(),
        'translation.notice.disclaimer': z.string().optional(),
        'translation.notice.authority': z.string().optional(),
        'translation.notice.englishSource': z.string().optional(),
        'translation.notice.statusLabel': z.string().optional(),
        'translation.notice.sourceVersionLabel': z.string().optional(),
        'translation.notice.dateLabel': z.string().optional(),
        'translation.status.complete': z.string().optional(),
        'translation.status.incomplete': z.string().optional(),
        'translation.status.outdated': z.string().optional(),
      }),
    }),
  }),
};
