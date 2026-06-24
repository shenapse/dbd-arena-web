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
        // Lifecycle metadata on normative regulation / policy pages.
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
        // localized pages record which English version they cover.
        language: z.string().optional(),
        translationStatus: z.enum(['complete', 'incomplete', 'outdated']).optional(),
        translatedVersion: z.string().optional(),
        translationDate: z.string().optional(),
        authoritativeSource: z.string().optional(),
        // Notice classification.
        type: z.string().optional(),
        date: z.string().optional(),
      }),
    }),
  }),
  // Localized UI strings for custom components (StatusBadge, LifecycleMeta).
  // Built-in Starlight UI strings are translated automatically per locale; these
  // custom keys are read via Astro.locals.t(). Files live in src/content/i18n/.
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
      }),
    }),
  }),
};
