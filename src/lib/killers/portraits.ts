// Killer portrait art (the balancing tool's lore art), stored as
// src/assets/killers/portraits/<killer key>.webp, where the key is the killer's
// killers.json slug without its leading "the-" (`the-dark-lord` -> `dark-lord`).
// Shared by the leaderboard cards (which already know the key) and the balancing
// overview cards (which only have a display name such as "Dracula" or "Wesker").
import type { ImageMetadata } from 'astro';
import killersJson from '../../data/dbd/killers.json' with { type: 'json' };
import { normalize } from '../balancing/normalize';

const portraitFiles = import.meta.glob<ImageMetadata>('../../assets/killers/portraits/*.webp', {
  eager: true,
  import: 'default',
});

/** Portrait files keyed by file name without extension. */
export const portraits = new Map<string, ImageMetadata>(
  Object.entries(portraitFiles).map(([path, image]) => [path.split('/').pop()!.replace(/\.webp$/, ''), image]),
);

interface KillerEntry {
  name: string;
  aliases?: string[];
}

// normalized name / alias -> killers.json slug (first occurrence wins).
const slugByName = new Map<string, string>();
for (const [slug, entry] of Object.entries(killersJson as Record<string, KillerEntry>)) {
  for (const label of [entry.name, ...(entry.aliases ?? [])]) {
    const key = normalize(label.trim());
    if (key && !slugByName.has(key)) slugByName.set(key, slug);
  }
}

/**
 * Killer key (killers.json slug without "the-") for a display name or alias
 * ("Dracula" -> "dark-lord", "The Nurse" -> "nurse"). Unknown names give undefined.
 */
export function killerKey(name: string): string | undefined {
  const slug = slugByName.get(normalize(name)) ?? slugByName.get(normalize(`The ${name}`));
  return slug?.replace(/^the-/, '');
}

/**
 * Portrait for a killer display name or alias ("Dracula", "Wesker", "The Nurse").
 * Unknown killers and killers without a portrait file give undefined.
 */
export function portraitForKiller(name: string): ImageMetadata | undefined {
  const key = killerKey(name);
  return key ? portraits.get(key) : undefined;
}
