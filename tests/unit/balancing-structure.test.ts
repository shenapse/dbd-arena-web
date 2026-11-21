import { describe, expect, it } from 'vitest';
import { balancingStructure, firstDifference } from '../../src/lib/docs/balancing-structure';

const LOCALES = ['ja', 'ko'] as const;

const english = `
import BalancingList from '@components/BalancingList.astro';
import ImageRow from '@components/ImageRow.astro';

<MatchConditions format="1v1" killer="wraith" />

## Killer perks

Choose one perk from the perk pool below.

<BalancingList format="1v1" killer="wraith" section="killerPerks" />

![Allowed perks](/images/builds/wraith/perks.png)

<ImageRow label="Allowed add-ons:" images={[
  { src: '/images/killers/wraith/bell.webp', label: 'Bell' },
]} />

## Response to crouch

M1 miss swing.

[← All per-killer balancing](/game-modes/1v1-symmetric/balancing/)

## Applies to

- [DBD 1v1 Symmetric Ranked](/game-modes/1v1-symmetric/)
`;

/** The English page translated the way the ja pages are. */
const japanese = english
  .replace(
    "import ImageRow from '@components/ImageRow.astro';",
    "import ImageRow from '@components/ImageRow.astro';\nimport TranslationNotice from '@components/TranslationNotice.astro';\n\n<TranslationNotice />",
  )
  .replace('Choose one perk from the perk pool below.', '以下のパークリストから1つを選択．')
  .replace('M1 miss swing.', '通常攻撃を\n空振り．')
  .replace('## Response to crouch', '## しゃがみへの対応')
  .replace('](/game-modes/', '](/ja/game-modes/')
  .replace('](/game-modes/', '](/ja/game-modes/');

const differs = (a: string, b: string) => firstDifference(balancingStructure(a, LOCALES), balancingStructure(b, LOCALES));

describe('balancingStructure', () => {
  it('keeps components, imports, images and link targets, and only the shape of prose', () => {
    expect(balancingStructure(english, LOCALES).map((item) => item.key)).toEqual([
      "import BalancingList from '@components/BalancingList.astro';",
      "import ImageRow from '@components/ImageRow.astro';",
      '<MatchConditions format="1v1" killer="wraith" />',
      'heading 2',
      'paragraph',
      '<BalancingList format="1v1" killer="wraith" section="killerPerks" />',
      'image /images/builds/wraith/perks.png',
      "<ImageRow label=\"Allowed add-ons:\" images={[ { src: '/images/killers/wraith/bell.webp', label: 'Bell' }, ]} />",
      'heading 2',
      'paragraph',
      'paragraph → /game-modes/1v1-symmetric/balancing/',
      'heading 2',
      'list item → /game-modes/1v1-symmetric/',
    ]);
  });

  it('records the body line each item starts on', () => {
    const items = balancingStructure(english, LOCALES);
    expect(items.find((item) => item.key.startsWith('<ImageRow'))?.line).toBe(15);
  });
});

describe('translated balancing pages', () => {
  it('agree with the English page when only prose and headings are translated', () => {
    expect(differs(english, japanese)).toBeNull();
  });

  it('differ when a component prop differs', () => {
    const changed = japanese.replace('section="killerPerks"', 'section="addons"');
    expect(differs(english, changed)?.localized?.key).toContain('section="addons"');
  });

  it('differ when a prop inside a multi-line component differs', () => {
    const changed = japanese.replace("label: 'Bell'", "label: 'Other'");
    expect(differs(english, changed)).not.toBeNull();
  });

  it('differ when a rule sentence is dropped or left untranslated beside its translation', () => {
    expect(differs(english, japanese.replace('通常攻撃を\n空振り．', ''))).not.toBeNull();
    const leftover = japanese.replace('以下のパークリストから1つを選択．', '以下のパークリストから1つを選択．\n\nChoose one perk from the perk pool below.');
    expect(differs(english, leftover)).toEqual({
      english: expect.objectContaining({ key: '<BalancingList format="1v1" killer="wraith" section="killerPerks" />' }),
      localized: expect.objectContaining({ key: 'paragraph' }),
    });
  });

  it('differ when a heading level, image or link target differs', () => {
    expect(differs(english, japanese.replace('## Killer perks', '### Killer perks'))).not.toBeNull();
    expect(differs(english, japanese.replace('perks.png', 'items.png'))).not.toBeNull();
    expect(differs(english, japanese.replace('/ja/game-modes/1v1-symmetric/)', '/ja/game-modes/1v1-asymmetric/)'))).not.toBeNull();
  });

  it('differ when the translation has extra items or ends early', () => {
    expect(differs(english, `${japanese}\n- [Extra](/game-modes/)\n`)).toEqual({
      english: undefined,
      localized: expect.objectContaining({ key: 'list item → /game-modes/' }),
    });
    const cut = japanese.slice(0, japanese.indexOf('## Applies to'));
    expect(differs(english, cut)?.localized).toBeUndefined();
  });
});
