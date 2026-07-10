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
    '/handbook/policies/match-interruptions/': '/handbook/trouble-handling/match-problems-and-remakes/',
    '/ja/handbook/policies/match-interruptions/': '/ja/handbook/trouble-handling/match-problems-and-remakes/',
    '/handbook/policies/match-problems-and-remakes/': '/handbook/trouble-handling/match-problems-and-remakes/',
    '/ja/handbook/policies/match-problems-and-remakes/': '/ja/handbook/trouble-handling/match-problems-and-remakes/',
    // Matchmaking-journey guides moved under /handbook/matchmaking-journey/.
    // The journey overview keeps its URL; these four sub-pages were nested.
    '/handbook/player-profile/': '/handbook/matchmaking-journey/player-profile/',
    '/ja/handbook/player-profile/': '/ja/handbook/matchmaking-journey/player-profile/',
    '/handbook/groups/': '/handbook/matchmaking-journey/groups/',
    '/ja/handbook/groups/': '/ja/handbook/matchmaking-journey/groups/',
    '/handbook/matchmaking-and-readiness/': '/handbook/matchmaking-journey/matchmaking-and-readiness/',
    '/ja/handbook/matchmaking-and-readiness/': '/ja/handbook/matchmaking-journey/matchmaking-and-readiness/',
    '/handbook/results/': '/handbook/matchmaking-journey/results/',
    '/ja/handbook/results/': '/ja/handbook/matchmaking-journey/results/',
    // `regulations` → `game-modes`: the user-facing term (and its URL segment)
    // was renamed from backend "regulation" jargon to "game mode". Astro's static
    // redirects need a concrete destination route, so the old subtree is mapped
    // explicitly page-by-page (en + ja) rather than with a rest-param pattern.
    '/regulations/': '/game-modes/',
    '/regulations/1v1-asymmetric/': '/game-modes/1v1-asymmetric/',
    '/regulations/1v1-symmetric/': '/game-modes/1v1-symmetric/',
    '/regulations/1v1-symmetric/balancing/': '/game-modes/1v1-symmetric/balancing/',
    '/regulations/1v1-symmetric/balancing/demogorgon/': '/game-modes/1v1-symmetric/balancing/demogorgon/',
    '/regulations/1v1-symmetric/balancing/doctor/': '/game-modes/1v1-symmetric/balancing/doctor/',
    '/regulations/1v1-symmetric/balancing/hillbilly/': '/game-modes/1v1-symmetric/balancing/hillbilly/',
    '/regulations/1v1-symmetric/balancing/nightmare/': '/game-modes/1v1-symmetric/balancing/nightmare/',
    '/regulations/1v1-symmetric/balancing/pig/': '/game-modes/1v1-symmetric/balancing/pig/',
    '/regulations/1v1-symmetric/balancing/template/': '/game-modes/1v1-symmetric/balancing/template/',
    '/regulations/1v1-symmetric/balancing/trapper/': '/game-modes/1v1-symmetric/balancing/trapper/',
    '/regulations/1v1-symmetric/balancing/wesker/': '/game-modes/1v1-symmetric/balancing/wesker/',
    '/regulations/1v1-symmetric/balancing/wraith/': '/game-modes/1v1-symmetric/balancing/wraith/',
    '/regulations/1v1-symmetric/rules/general/': '/game-modes/1v1-symmetric/rules/general/',
    '/regulations/1v4-duo/': '/game-modes/1v4-duo/',
    '/regulations/1v4-duo/balancing/': '/game-modes/1v4-duo/balancing/',
    '/regulations/1v4-duo/balancing/billy/': '/game-modes/1v4-duo/balancing/billy/',
    '/regulations/1v4-duo/balancing/blight/': '/game-modes/1v4-duo/balancing/blight/',
    '/regulations/1v4-duo/balancing/clown/': '/game-modes/1v4-duo/balancing/clown/',
    '/regulations/1v4-duo/balancing/doctor/': '/game-modes/1v4-duo/balancing/doctor/',
    '/regulations/1v4-duo/balancing/dracula/': '/game-modes/1v4-duo/balancing/dracula/',
    '/regulations/1v4-duo/balancing/ghoul/': '/game-modes/1v4-duo/balancing/ghoul/',
    '/regulations/1v4-duo/balancing/lich/': '/game-modes/1v4-duo/balancing/lich/',
    '/regulations/1v4-duo/balancing/nightmare/': '/game-modes/1v4-duo/balancing/nightmare/',
    '/regulations/1v4-duo/balancing/nurse/': '/game-modes/1v4-duo/balancing/nurse/',
    '/regulations/1v4-duo/balancing/oni/': '/game-modes/1v4-duo/balancing/oni/',
    '/regulations/1v4-duo/balancing/skelton/': '/game-modes/1v4-duo/balancing/skelton/',
    '/regulations/1v4-duo/balancing/spirit/': '/game-modes/1v4-duo/balancing/spirit/',
    '/regulations/1v4-duo/balancing/unknown/': '/game-modes/1v4-duo/balancing/unknown/',
    '/regulations/1v4-duo/balancing/wesker/': '/game-modes/1v4-duo/balancing/wesker/',
    '/regulations/1v4-duo/balancing/wraith/': '/game-modes/1v4-duo/balancing/wraith/',
    '/regulations/1v4-quartet/': '/game-modes/1v4-quartet/',
    '/regulations/1v4-quartet/balancing/': '/game-modes/1v4-quartet/balancing/',
    '/regulations/1v4-quartet/balancing/billy/': '/game-modes/1v4-quartet/balancing/billy/',
    '/regulations/1v4-quartet/balancing/blight/': '/game-modes/1v4-quartet/balancing/blight/',
    '/regulations/1v4-quartet/balancing/clown/': '/game-modes/1v4-quartet/balancing/clown/',
    '/regulations/1v4-quartet/balancing/doctor/': '/game-modes/1v4-quartet/balancing/doctor/',
    '/regulations/1v4-quartet/balancing/dracula/': '/game-modes/1v4-quartet/balancing/dracula/',
    '/regulations/1v4-quartet/balancing/ghoul/': '/game-modes/1v4-quartet/balancing/ghoul/',
    '/regulations/1v4-quartet/balancing/lich/': '/game-modes/1v4-quartet/balancing/lich/',
    '/regulations/1v4-quartet/balancing/nightmare/': '/game-modes/1v4-quartet/balancing/nightmare/',
    '/regulations/1v4-quartet/balancing/nurse/': '/game-modes/1v4-quartet/balancing/nurse/',
    '/regulations/1v4-quartet/balancing/oni/': '/game-modes/1v4-quartet/balancing/oni/',
    '/regulations/1v4-quartet/balancing/pig/': '/game-modes/1v4-quartet/balancing/pig/',
    '/regulations/1v4-quartet/balancing/skelton/': '/game-modes/1v4-quartet/balancing/skelton/',
    '/regulations/1v4-quartet/balancing/spirit/': '/game-modes/1v4-quartet/balancing/spirit/',
    '/regulations/1v4-quartet/balancing/unknown/': '/game-modes/1v4-quartet/balancing/unknown/',
    '/regulations/1v4-quartet/balancing/wesker/': '/game-modes/1v4-quartet/balancing/wesker/',
    '/regulations/1v4-quartet/balancing/wraith/': '/game-modes/1v4-quartet/balancing/wraith/',
    '/regulations/1v4-quartet/rules/general/': '/game-modes/1v4-quartet/rules/general/',
    '/ja/regulations/': '/ja/game-modes/',
    '/ja/regulations/1v1-symmetric/': '/ja/game-modes/1v1-symmetric/',
    '/ja/regulations/1v1-symmetric/rules/general/': '/ja/game-modes/1v1-symmetric/rules/general/',
    '/ja/regulations/1v4-duo/': '/ja/game-modes/1v4-duo/',
    '/ja/regulations/1v4-quartet/': '/ja/game-modes/1v4-quartet/',
    '/ja/regulations/1v4-quartet/rules/general/': '/ja/game-modes/1v4-quartet/rules/general/',
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
        'Find opponents for custom matches under published game modes.',
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
      // (drafts/README.md). The Game Modes branch is expanded all the way down
      // so a specific killer's balancing is reachable in one step.
      sidebar: [
        { label: 'Home', translations: { ja: 'ホーム' }, link: '/' },
        { label: 'What Is DBD Arena', translations: { ja: 'DBD Arena とは' }, slug: 'what-is-arena' },
        { label: 'Start Playing', translations: { ja: 'はじめる' }, slug: 'start' },
        {
          label: 'Game Modes',
          translations: { ja: 'ゲームモード' },
          items: [
            { label: 'Overview', translations: { ja: '概要' }, slug: 'game-modes' },
            {
              label: 'Active',
              translations: { ja: '稼働中' },
              items: [
                {
                  label: 'DBD 1v1 Symmetric Ranked',
                  items: [
                    { label: 'Overview', translations: { ja: '概要' }, slug: 'game-modes/1v1-symmetric' },
                    { label: 'General Rule', translations: { ja: '基本ルール' }, slug: 'game-modes/1v1-symmetric/rules/general' },
                    {
                      label: 'Balancing',
                      translations: { ja: 'バランス調整' },
                      items: [
                        { label: 'Overview', translations: { ja: '概要' }, slug: 'game-modes/1v1-symmetric/balancing' },
                        { label: 'Trapper', translations: { ja: 'トラッパー' }, slug: 'game-modes/1v1-symmetric/balancing/trapper' },
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
                  label: 'DBD 1v4 Quartet Ranked',
                  items: [
                    { label: 'Overview', translations: { ja: '概要' }, slug: 'game-modes/1v4-quartet' },
                    { label: 'General Rule', translations: { ja: '基本ルール' }, slug: 'game-modes/1v4-quartet/rules/general' },
                    {
                      label: 'Balancing',
                      translations: { ja: 'バランス調整' },
                      items: [
                        { label: 'Overview', translations: { ja: '概要' }, slug: 'game-modes/1v4-quartet/balancing' },
                      ],
                    },
                  ],
                },
                {
                  label: 'DBD 1v4 Duo+Duo Ranked',
                  items: [
                    { label: 'Overview', translations: { ja: '概要' }, slug: 'game-modes/1v4-duo' },
                    {
                      label: 'Balancing',
                      translations: { ja: 'バランス調整' },
                      items: [
                        { label: 'Overview', translations: { ja: '概要' }, slug: 'game-modes/1v4-duo/balancing' },
                        { label: 'Nurse', translations: { ja: 'ナース' }, slug: 'game-modes/1v4-duo/balancing/nurse' },
                        { label: 'Blight', translations: { ja: 'ブライト' }, slug: 'game-modes/1v4-duo/balancing/blight' },
                        { label: 'Spirit', translations: { ja: 'スピリット' }, slug: 'game-modes/1v4-duo/balancing/spirit' },
                        { label: 'Wraith', translations: { ja: 'レイス' }, slug: 'game-modes/1v4-duo/balancing/wraith' },
                        { label: 'Hillbilly', translations: { ja: 'ヒルビリー' }, slug: 'game-modes/1v4-duo/balancing/billy' },
                        { label: 'Doctor', translations: { ja: 'ドクター' }, slug: 'game-modes/1v4-duo/balancing/doctor' },
                        { label: 'Nightmare', translations: { ja: 'ナイトメア' }, slug: 'game-modes/1v4-duo/balancing/nightmare' },
                        { label: 'Clown', translations: { ja: 'クラウン' }, slug: 'game-modes/1v4-duo/balancing/clown' },
                        { label: 'Oni', translations: { ja: '鬼' }, slug: 'game-modes/1v4-duo/balancing/oni' },
                        { label: 'Unknown', translations: { ja: 'アンノウン' }, slug: 'game-modes/1v4-duo/balancing/unknown' },
                        { label: 'Lich', translations: { ja: 'リッチ' }, slug: 'game-modes/1v4-duo/balancing/lich' },
                        { label: 'Dracula', translations: { ja: 'ドラキュラ' }, slug: 'game-modes/1v4-duo/balancing/dracula' },
                        { label: 'Wesker', translations: { ja: 'ウェスカー' }, slug: 'game-modes/1v4-duo/balancing/wesker' },
                        { label: 'Ghoul', translations: { ja: 'グール' }, slug: 'game-modes/1v4-duo/balancing/ghoul' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Reference',
          translations: { ja: 'リファレンス' },
          items: [
            { label: 'Perk Restriction Types', translations: { ja: 'パーク制限の種類' }, slug: 'game-modes/reference/perk-restriction-types' },
          ],
        },
        {
          label: 'Handbook',
          translations: { ja: 'ハンドブック' },
          items: [
            { label: 'Handbook Contents', slug: 'handbook' },
            {
              label: 'Matchmaking Journey',
              translations: { ja: 'マッチメイキングの流れ' },
              items: [
                { label: 'Journey', translations: { ja: '概要' }, slug: 'handbook/matchmaking-journey' },
                { label: 'Player Profile', translations: { ja: 'プレイヤープロフィール' }, slug: 'handbook/matchmaking-journey/player-profile' },
                { label: 'Groups', translations: { ja: 'グループ' }, slug: 'handbook/matchmaking-journey/groups' },
                { label: 'Matchmaking and Readiness', translations: { ja: 'マッチメイキングと準備状態' }, slug: 'handbook/matchmaking-journey/matchmaking-and-readiness' },
                { label: 'Results', translations: { ja: '結果報告' }, slug: 'handbook/matchmaking-journey/results' },
              ],
            },
            {
              label: 'Arena Policies',
              translations: { ja: 'アリーナポリシー' },
              items: [
                { label: 'Overview', translations: { ja: '概要' }, slug: 'handbook/policies' },
                {
                  label: 'Participation and Conduct',
                  translations: { ja: '参加者の心得' },
                  slug: 'handbook/policies/participation-and-conduct',
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
              label: 'Trouble Handling',
              translations: { ja: 'トラブル対応' },
              items: [
                {
                  label: 'Match Problems',
                  translations: { ja: '試合関連のトラブル' },
                  slug: 'handbook/trouble-handling/match-problems-and-remakes',
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
                      label: 'Player Value',
                      slug: 'handbook/concept/competitive-design/player-value',
                    },
                    {
                      label: 'Controlled Formats',
                      slug: 'handbook/concept/competitive-design/controlled-formats',
                    },          
                    {
                      label: 'Rating model',
                      slug: 'handbook/concept/competitive-design/competitor-context-rating-model',
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
