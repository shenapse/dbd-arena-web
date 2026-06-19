// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { DISCORD_INVITE } from './src/constants.ts';

// Provisional service name — carried over from the earlier site skeleton as a
// placeholder. Final branding is a website-design decision (UX §7.1).
const SERVICE_NAME = 'DBD Arena';

export default defineConfig({
  integrations: [
    starlight({
      customCss: ['./src/styles/custom.css'],
      title: SERVICE_NAME,
      description:
        'Community-run, unofficial competitive Dead by Daylight matchmaking. ' +
        'Find opponents for custom matches under published regulations.',
      // English-only today, but i18n-ready: the root locale keeps URLs clean
      // (/handbook/... not /en/handbook/...). Adding a language later is
      // config-only (UX §6 localization-readiness).
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
      },
      // Outbound Discord handoff (UX §9). Header social icon.
      social: [{ icon: 'discord', label: 'Join Discord', href: DISCORD_INVITE }],
      // Hierarchical sidebar mirroring docs/UX-dbd-website-structure.md §2–3.
      // Hand-authored: the old data-driven self-assembling sidebar is dropped
      // (drafts/README.md). The Regulations branch is expanded all the way down
      // so a specific killer's balancing is reachable in one step.
      sidebar: [
        { label: 'Home', link: '/' },
        { label: 'The Arena Difference', slug: 'why' },
        { label: 'Start Playing', slug: 'start' },
        {
          label: 'Regulation',
          items: [
            { label: 'Overview', slug: 'regulations' },
            {
              label: 'Active',
              items: [
                {
                  label: 'DBD 1v4 Quartet Ranked',
                  items: [
                    { label: 'Overview', slug: 'regulations/dbd-1v4-quartet-rank' },
                    { label: 'General Rule', slug: 'regulations/rules/1v4-quartet-general' },
                    {
                      label: 'Balancing',
                      items: [
                        { label: 'Overview', slug: 'regulations/balancing' },
                        { label: 'Nurse', slug: 'regulations/balancing/1v4-quartet-nurse' },
                        { label: 'Blight', slug: 'regulations/balancing/1v4-quartet-blight' },
                        { label: 'Spirit', slug: 'regulations/balancing/1v4-quartet-spirit' },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              label: 'Upcoming',
              items: [
                {
                  label: 'DBD 1v1 Symmetric Ranked',
                  slug: 'regulations/dbd-1v1-symmetric-rank',
                },
              ],
            },
          ],
        },
        {
          label: 'Handbook',
          items: [
            { label: 'Matchmaking Journey', slug: 'handbook/matchmaking-journey' },
            { label: 'Player Profile', slug: 'handbook/player-profile' },
            { label: 'Groups', slug: 'handbook/groups' },
            { label: 'Matchmaking and Readiness', slug: 'handbook/matchmaking-and-readiness' },
            { label: 'Results', slug: 'handbook/results' },
            {
              label: 'Player Policies',
              items: [
                { label: 'Overview', slug: 'handbook/policies' },
                {
                  label: 'Participation and Conduct',
                  slug: 'handbook/policies/participation-and-conduct',
                },
                {
                  label: 'Match Interruptions',
                  slug: 'handbook/policies/match-interruptions',
                },
                {
                  label: 'Results and Disputes',
                  slug: 'handbook/policies/results-and-disputes',
                },
                {
                  label: 'Privacy and Public Data',
                  slug: 'handbook/policies/privacy-and-public-data',
                },
              ],
            },
            {
              label: 'Concept',
              items: [
                { label: 'Rating Guide', slug: 'handbook/concept/rating-guide' },
              ],
            },
          ],
        },
        {
          label: 'Help',
          items: [
            { label: 'Help', slug: 'help' },
            { label: 'FAQ', slug: 'help/faq' },
            { label: 'Account and Group', slug: 'help/account-and-group' },
            { label: 'Queue and Readiness', slug: 'help/queue-and-readiness' },
            { label: 'Result and Dispute', slug: 'help/result-and-dispute' },
          ],
        },
        {
          label: 'Notices',
          items: [
            { label: 'Notices', slug: 'notices' },
            { label: 'Scheduled maintenance window', slug: 'notices/2026-06-20-maintenance' },
            { label: 'Service launch', slug: 'notices/2026-06-15-launch' },
          ],
        },
        { label: 'About This Service', slug: 'about' },
        { label: 'Join Discord', link: DISCORD_INVITE, attrs: { target: '_blank' } },
      ],
    }),
  ],
});
