import { t } from '@/i18n';
import type { Category } from '@/types';
import { IMG } from './images';

/** Category tiles. Functions (not constants) so names follow the selected language. */
const tile = (slug: 'football-boots' | 'team-kits' | 'jerseys' | 'polo-shirts' | 'socks' | 'bags' | 'turf-shoes' | 't-shirts' | 'tracksuits' | 'balls' | 'goalkeeper-gloves' | 'shorts', image: string): Category => ({
  slug,
  name: t(`common.category.${slug}`),
  description: t(`collections.tiles.${slug}`),
  image,
  href: `/categories/${slug}`,
});

/** Featured categories on the homepage and /categories (two feature tiles first). */
export const getFeaturedCategories = (): Category[] => [
  tile('football-boots', IMG.kickOrangeBoot),
  tile('team-kits', IMG.teamWalkout),
  tile('jerseys', IMG.jerseyBlackGold),
  tile('polo-shirts', IMG.poloCoach),
  tile('socks', IMG.socksGrip),
  tile('bags', IMG.backpackPitch),
];

export const getMoreCategories = (): Category[] => [
  tile('turf-shoes', IMG.turfShoes),
  tile('t-shirts', IMG.teeBlack),
  tile('shorts', IMG.shortsAction),
  tile('tracksuits', IMG.tracksuitTeam),
  tile('balls', IMG.ballsTrio),
  tile('goalkeeper-gloves', IMG.gkGloves),
];
