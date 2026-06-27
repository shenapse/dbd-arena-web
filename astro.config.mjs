// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { DISCORD_INVITE } from './src/constants.ts';

// Provisional service name — carried over from the earlier site skeleton as a
// placeholder. Final branding is a website-design decision (UX §7.1).
const SERVICE_NAME = 'DBD Arena';

export default defineConfig({
  // Preserve old URLs after a page is renamed so external links/bookmarks
  // don't 404. `match-interruptions` → `match-problems-and-remakes`.
  redirects: {
    '/handbook/policies/match-interruptions/': '/handbook/policies/match-problems-and-remakes/',
    '/ja/handbook/policies/match-interruptions/': '/ja/handbook/policies/match-problems-and-remakes/',
  },
  integrations: [
    starlight({
      customCss: ['./src/styles/custom.css'],
      // Header brand link rendered as a two-tone crimson wordmark (matches the
      // home-page hero). See src/components/SiteTitle.astro.
      // Header override surfaces a mobile-only language switcher in the top bar
      // (Starlight otherwise hides it below 50rem). See src/components/Header.astro.
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        Header: './src/components/Header.astro',
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
      // English is the authoritative default and keeps clean URLs via the root
      // locale (/handbook/... not /en/handbook/...). Japanese is served under
      // /ja/...; pages without a ja translation fall back to the English content
      // with Starlight's built-in untranslated-content notice (UX §6). Sidebar
      // and custom-component labels are localized below / via src/content/i18n.
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        ja: { label: '日本語', lang: 'ja' },
      },
      // Outbound Discord handoff (UX §9). Header social icon.
      social: [{ icon: 'discord', label: 'Join Discord', href: DISCORD_INVITE }],
      // Hierarchical sidebar mirroring docs/UX-dbd-website-structure.md §2–3.
      // Hand-authored: the old data-driven self-assembling sidebar is dropped
      // (drafts/README.md). The Regulations branch is expanded all the way down
      // so a specific killer's balancing is reachable in one step.
      sidebar: [
        { label: 'Home', translations: { ja: 'ホーム' }, link: '/' },
        { label: 'What Is DBD Arena', translations: { ja: 'DBD Arena とは' }, slug: 'what-is-arena' },
        { label: 'Start Playing', translations: { ja: 'はじめる' }, slug: 'start' },
        {
          label: 'Regulation',
          translations: { ja: 'レギュレーション' },
          items: [
            { label: 'Overview', translations: { ja: '概要' }, slug: 'regulations' },
            {
              label: 'Active',
              translations: { ja: '稼働中' },
              items: [
                {
                  label: 'DBD 1v4 Quartet Ranked',
                  items: [
                    { label: 'Overview', translations: { ja: '概要' }, slug: 'regulations/1v4-quartet' },
                    { label: 'General Rule', translations: { ja: '基本ルール' }, slug: 'regulations/1v4-quartet/rules/general' },
                    {
                      label: 'Balancing',
                      translations: { ja: 'バランス調整' },
                      items: [
                        { label: 'Overview', translations: { ja: '概要' }, slug: 'regulations/1v4-quartet/balancing' },
                        { label: 'Nurse', translations: { ja: 'ナース' }, slug: 'regulations/1v4-quartet/balancing/nurse' },
                        { label: 'Blight', translations: { ja: 'ブライト' }, slug: 'regulations/1v4-quartet/balancing/blight' },
                        { label: 'Spirit', translations: { ja: 'スピリット' }, slug: 'regulations/1v4-quartet/balancing/spirit' },
                        { label: 'Wraith', translations: { ja: 'レイス' }, slug: 'regulations/1v4-quartet/balancing/wraith' },
                        { label: 'Hillbilly', translations: { ja: 'ヒルビリー' }, slug: 'regulations/1v4-quartet/balancing/billy' },
                        { label: 'Doctor', translations: { ja: 'ドクター' }, slug: 'regulations/1v4-quartet/balancing/doctor' },
                        { label: 'Nightmare', translations: { ja: 'ナイトメア' }, slug: 'regulations/1v4-quartet/balancing/nightmare' },
                        { label: 'Pig', translations: { ja: 'ピッグ' }, slug: 'regulations/1v4-quartet/balancing/pig' },
                        { label: 'Clown', translations: { ja: 'クラウン' }, slug: 'regulations/1v4-quartet/balancing/clown' },
                        { label: 'Oni', translations: { ja: '鬼' }, slug: 'regulations/1v4-quartet/balancing/oni' },
                        { label: 'Unknown', translations: { ja: 'アンノウン' }, slug: 'regulations/1v4-quartet/balancing/unknown' },
                        { label: 'Lich', translations: { ja: 'リッチ' }, slug: 'regulations/1v4-quartet/balancing/lich' },
                        { label: 'Dracula', translations: { ja: 'ドラキュラ' }, slug: 'regulations/1v4-quartet/balancing/dracula' },
                        { label: 'Wesker', translations: { ja: 'ウェスカー' }, slug: 'regulations/1v4-quartet/balancing/wesker' },
                        { label: 'Ghoul', translations: { ja: 'グール' }, slug: 'regulations/1v4-quartet/balancing/ghoul' },
                      ],
                    },
                  ],
                },
                {
                  label: 'DBD 1v1 Symmetric Ranked',
                  items: [
                    { label: 'Overview', translations: { ja: '概要' }, slug: 'regulations/1v1-symmetric' },
                    { label: 'General Rule', translations: { ja: '基本ルール' }, slug: 'regulations/1v1-symmetric/rules/general' },
                    {
                      label: 'Balancing',
                      translations: { ja: 'バランス調整' },
                      items: [
                        { label: 'Overview', translations: { ja: '概要' }, slug: 'regulations/1v1-symmetric/balancing' },
                        { label: 'Trapper', translations: { ja: 'トラッパー' }, slug: 'regulations/1v1-symmetric/balancing/trapper' },
                        { label: 'Wraith', translations: { ja: 'レイス' }, slug: 'regulations/1v1-symmetric/balancing/wraith' },
                        { label: 'Hillbilly', translations: { ja: 'ヒルビリー' }, slug: 'regulations/1v1-symmetric/balancing/hillbilly' },
                        { label: 'Doctor', translations: { ja: 'ドクター' }, slug: 'regulations/1v1-symmetric/balancing/doctor' },
                        { label: 'Nightmare', translations: { ja: 'ナイトメア' }, slug: 'regulations/1v1-symmetric/balancing/nightmare' },
                        { label: 'Pig', translations: { ja: 'ピッグ' }, slug: 'regulations/1v1-symmetric/balancing/pig' },
                        { label: 'Wesker', translations: { ja: 'ウェスカー' }, slug: 'regulations/1v1-symmetric/balancing/wesker' },
                        { label: 'Demogorgon', translations: { ja: 'デモゴルゴン' }, slug: 'regulations/1v1-symmetric/balancing/demogorgon' },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              label: 'Upcoming',
              translations: { ja: '予定' },
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
          translations: { ja: 'ハンドブック' },
          items: [
            { label: 'Overview', translations: { ja: '概要' }, slug: 'handbook' },
            { label: 'Matchmaking Journey', translations: { ja: 'マッチメイキングの流れ' }, slug: 'handbook/matchmaking-journey' },
            { label: 'Player Profile', translations: { ja: 'プレイヤープロフィール' }, slug: 'handbook/player-profile' },
            { label: 'Groups', translations: { ja: 'グループ' }, slug: 'handbook/groups' },
            { label: 'Matchmaking and Readiness', translations: { ja: 'マッチメイキングと準備状態' }, slug: 'handbook/matchmaking-and-readiness' },
            { label: 'Results', translations: { ja: '結果報告' }, slug: 'handbook/results' },
            {
              label: 'Player Policies',
              translations: { ja: 'プレイヤーポリシー' },
              items: [
                { label: 'Overview', translations: { ja: '概要' }, slug: 'handbook/policies' },
                {
                  label: 'Participation and Conduct',
                  translations: { ja: '参加者の心得' },
                  slug: 'handbook/policies/participation-and-conduct',
                },
                {
                  label: 'Match Problems',
                  translations: { ja: '試合関連のトラブル' },
                  slug: 'handbook/policies/match-problems-and-remakes',
                },
                // {
                //   label: 'Results and Disputes',
                //   translations: { ja: '結果と異議申し立て' },
                //   slug: 'handbook/policies/results-and-disputes',
                // },
                {
                  label: 'Privacy and Public Data',
                  translations: { ja: 'プライバシーと公開データ' },
                  slug: 'handbook/policies/privacy-and-public-data',
                },
              ],
            },
            {
              label: 'Concept',
              translations: { ja: 'コンセプト' },
              items: [
                {
                  label: 'Competitive Design',
                  translations: { ja: '競技デザイン' },
                  items: [
                    {
                      label: 'Introduction',
                      slug: 'handbook/concept/competitive-design',
                    },
                    {
                      label: 'Controlled Formats',
                      slug: 'handbook/concept/competitive-design/controlled-formats',
                    },
                    {
                      label: 'Rating Dimensions',
                      slug: 'handbook/concept/competitive-design/context-specific-rating-dimensions',
                    },
                    {
                      label: 'Competitor Units',
                      slug: 'handbook/concept/competitive-design/competitor-unit-attribution',
                    },
                    {
                      label: 'Repeated Evidence',
                      slug: 'handbook/concept/competitive-design/repeated-calibrated-evidence',
                    },
                    {
                      label: 'Extra Context',
                      slug: 'handbook/concept/competitive-design/extra',
                    },
                  ],
                },
                { label: 'Rating Guide', translations: { ja: 'レーティングガイド' }, slug: 'handbook/concept/rating-guide' },
              ],
            },
          ],
        },
        {
          label: 'Help',
          translations: { ja: 'ヘルプ' },
          items: [
            { label: 'Help', translations: { ja: 'ヘルプ' }, slug: 'help' },
            { label: 'FAQ', translations: { ja: 'よくある質問' }, slug: 'help/faq' },
            { label: 'Account and Group', translations: { ja: 'アカウントとグループ' }, slug: 'help/account-and-group' },
            { label: 'Queue and Readiness', translations: { ja: 'キューと準備状態' }, slug: 'help/queue-and-readiness' },
            // { label: 'Result and Dispute', translations: { ja: '結果と異議申し立て' }, slug: 'help/result-and-dispute' },
          ],
        },
        {
          label: 'Notices',
          translations: { ja: 'お知らせ' },
          items: [
            { label: 'Notices', translations: { ja: 'お知らせ' }, slug: 'notices' },
            { label: 'Website launch', translations: { ja: 'Website 公開' }, slug: 'notices/2026-06-15-launch' },
          ],
        },
        { label: 'About This Service', translations: { ja: 'このサービスについて' }, slug: 'about' },
        { label: 'Join Discord', translations: { ja: 'Discord に参加' }, link: DISCORD_INVITE, attrs: { target: '_blank' } },
      ],
    }),
  ],
});
