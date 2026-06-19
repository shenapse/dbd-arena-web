import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

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
        status: z.enum(['active', 'upcoming', 'archived']).optional(),
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
        // Notice classification.
        type: z.string().optional(),
        date: z.string().optional(),
      }),
    }),
  }),
};
