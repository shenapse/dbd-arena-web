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
      // Header brand link rendered as a two-tone crimson wordmark (matches the
      // home-page hero). See src/components/SiteTitle.astro.
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
      },
      title: SERVICE_NAME,
      // Brand favicon — bold crimson "A" mark on a dark circle (public/favicon.svg).
      // SVG for modern browsers; PNG sizes added via `head` below as fallback.
      favicon: '/favicon.svg',
      head: [
        // PNG favicon fallback + apple-touch icon for browsers/OSes that don't
        // pick up the SVG. Files live in public/.
        {
          tag: 'link',
          attrs: { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        },
        {
          tag: 'link',
          attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon-180.png' },
        },
        // Webfonts: Inter is the site-wide body/heading face (set via --sl-font
        // in custom.css); Barlow Condensed powers the header "DBDA" wordmark
        // (SiteTitle.astro), matching the approved condensed logo lockup. Both
        // families are requested in one swap-loaded stylesheet.
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@800&family=Inter:wght@400;500;600;700&display=swap',
          },
        },
      ],
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
        { label: 'What Is DBD Arena', slug: 'what-is-arena' },
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
                    { label: 'Overview', slug: 'regulations/1v4-quartet' },
                    { label: 'General Rule', slug: 'regulations/1v4-quartet/rules/general' },
                    {
                      label: 'Balancing',
                      items: [
                        { label: 'Overview', slug: 'regulations/1v4-quartet/balancing' },
                        { label: 'Nurse', slug: 'regulations/1v4-quartet/balancing/nurse' },
                        { label: 'Blight', slug: 'regulations/1v4-quartet/balancing/blight' },
                        { label: 'Spirit', slug: 'regulations/1v4-quartet/balancing/spirit' },
                      ],
                    },
                  ],
                },
                {
                  label: 'DBD 1v1 Symmetric Ranked',
                  items: [
                    { label: 'Overview', slug: 'regulations/1v1-symmetric' },
                    { label: 'General Rule', slug: 'regulations/1v1-symmetric/rules/general' },
                    {
                      label: 'Balancing',
                      items: [
                        { label: 'Overview', slug: 'regulations/1v1-symmetric/balancing' },
                        { label: 'Trapper', slug: 'regulations/1v1-symmetric/balancing/trapper' },
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
                  label: 'DBD 1v4 Duo+Duo Ranked',
                  slug: 'regulations/1v4-duo',
                },
              ],
            },
          ],
        },
        {
          label: 'Handbook',
          items: [
            { label: 'Overview', slug: 'handbook' },
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
                {
                  label: 'Competitive Design',
                  slug: 'handbook/concept/competitive-design',
                },
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
