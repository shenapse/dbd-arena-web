// Centralized constants for the DBD Arena site.

// Placeholder Discord invite. The real stable invitation is supplied at the
// content/handoff layer; this skeleton uses the project home as a stand-in so
// the outbound handoff is wired without claiming a real destination.
export const DISCORD_INVITE = 'https://discord.com/';

// PLACEHOLDER — swap for the real Twitter/X handle before launch. Until the
// Discord server is public, this is the only contact channel advertised for
// getting an invite.
export const TWITTER_CONTACT_HANDLE = '@DBDArena';
export const TWITTER_CONTACT_URL = 'https://x.com/DBDArena';

// Shown in place of navigating to Discord while the server isn't public yet
// (see the click-intercept script in astro.config.mjs's `head` config).
export const DISCORD_CLOSED_MESSAGE =
  "The DBD Arena Discord isn't open to the public yet. " +
  `Message us on Twitter/X (${TWITTER_CONTACT_HANDLE}) to request an invite.`;
