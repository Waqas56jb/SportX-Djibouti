import { tDynamic } from '@/i18n';
import { IMG } from './images';

/**
 * Merchandising copy for collection landing pages. Product membership is decided by the API
 * (`GET /products?collection=<key>`), so there is no client-side matching here. Copy lives in the
 * `collections` translation namespace; `getCollection` resolves it for the current language.
 */
export interface Collection {
  key: string;
  path: string;
  title: string;
  eyebrow: string;
  description: string;
  image: string;
}

const PAGES: { key: string; path: string; image: string }[] = [
  { key: 'shop', path: '/shop', image: IMG.heroNightTraining },
  { key: 'men', path: '/men', image: IMG.playerVoltKit },
  { key: 'women', path: '/women', image: IMG.headerDuel },
  { key: 'football', path: '/football', image: IMG.stadiumNight },
  { key: 'training', path: '/training', image: IMG.poloCoach },
  { key: 'equipment', path: '/equipment', image: IMG.ballsTrio },
  { key: 'new-arrivals', path: '/new-arrivals', image: IMG.kickOrangeBoot },
  { key: 'sale', path: '/sale', image: IMG.stadiumFloodlit },
];

/** Department & category landing pages served at /categories/:slug. */
const CATEGORY_PAGES: { key: string; image: string }[] = [
  { key: 'footwear', image: IMG.bootsOrangeCorner },
  { key: 'apparel', image: IMG.teamWalkout },
  { key: 'accessories', image: IMG.socksCleats },
  { key: 'football-boots', image: IMG.bootsOrangeCorner },
  { key: 'turf-shoes', image: IMG.turfShoes },
  { key: 'jerseys', image: IMG.jerseyBlackGold },
  { key: 'team-kits', image: IMG.teamWalkout },
  { key: 'polo-shirts', image: IMG.poloCoach },
  { key: 't-shirts', image: IMG.teeBlack },
  { key: 'shorts', image: IMG.shortsAction },
  { key: 'tracksuits', image: IMG.tracksuitTeam },
  { key: 'socks', image: IMG.socksGrip },
  { key: 'bags', image: IMG.backpackPitch },
  { key: 'goalkeeper-gloves', image: IMG.gkGloves },
  { key: 'balls', image: IMG.ballsTrio },
];

const withCopy = (key: string, path: string, image: string): Collection => ({
  key,
  path,
  image,
  title: tDynamic(`collections.${key}.title`, key),
  eyebrow: tDynamic(`collections.${key}.eyebrow`, ''),
  description: tDynamic(`collections.${key}.description`, ''),
});

export const getCollections = (): Collection[] => PAGES.map((p) => withCopy(p.key, p.path, p.image));

export const getAllCollections = (): Collection[] => [
  ...getCollections(),
  ...CATEGORY_PAGES.map((c) => withCopy(c.key, `/categories/${c.key}`, c.image)),
];

export const getCollection = (key: string) => getAllCollections().find((c) => c.key === key);
