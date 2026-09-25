import { IMG } from './images';

/**
 * Static merchandising copy for collection landing pages. Product membership is decided by the API
 * (`GET /products?collection=<key>`), so there is no client-side matching here.
 */
export interface Collection {
  key: string;
  path: string;
  title: string;
  eyebrow: string;
  description: string;
  image: string;
}

export const COLLECTIONS: Collection[] = [
  {
    key: 'shop',
    path: '/shop',
    title: 'Shop All',
    eyebrow: 'The full range',
    description: 'Footwear, apparel and equipment engineered for every sport and every session.',
    image: IMG.trDarkAthlete,
  },
  {
    key: 'men',
    path: '/men',
    title: 'Men',
    eyebrow: 'Men’s performance',
    description: 'Match-day boots, court shoes, training kit and everyday essentials built for men who compete.',
    image: IMG.trCurl,
  },
  {
    key: 'women',
    path: '/women',
    title: 'Women',
    eyebrow: 'Women’s performance',
    description: 'Technical running, studio and training gear cut for women’s movement and made to perform.',
    image: IMG.trStrongWoman,
  },
  {
    key: 'kids',
    path: '/kids',
    title: 'Kids',
    eyebrow: 'The next generation',
    description: 'Tough, comfortable gear for young athletes — from school pitches to weekend academies.',
    image: IMG.kidsJacket,
  },
  {
    key: 'football',
    path: '/football',
    title: 'Football',
    eyebrow: 'Built for the game',
    description: 'Boots, match balls, jerseys and essentials for players who live for ninety minutes.',
    image: IMG.fbNightPitch,
  },
  {
    key: 'basketball',
    path: '/basketball',
    title: 'Basketball',
    eyebrow: 'Own the court',
    description: 'Court shoes, game balls and hoops apparel engineered for explosive play.',
    image: IMG.bbArena,
  },
  {
    key: 'running',
    path: '/running',
    title: 'Running',
    eyebrow: 'Go further',
    description: 'Daily trainers, race shoes and run apparel for every pace and every distance.',
    image: IMG.runTrackTop,
  },
  {
    key: 'training',
    path: '/training',
    title: 'Training',
    eyebrow: 'Train without limits',
    description: 'Gym-ready footwear, sweat-wicking apparel and equipment for strength, HIIT and conditioning.',
    image: IMG.trDarkLift,
  },
  {
    key: 'equipment',
    path: '/equipment',
    title: 'Equipment',
    eyebrow: 'Gear up',
    description: 'Balls, gym equipment, bags and accessories trusted by clubs, schools and athletes.',
    image: IMG.trDumbbellRack,
  },
  {
    key: 'new-arrivals',
    path: '/new-arrivals',
    title: 'New Arrivals',
    eyebrow: 'Just landed',
    description: 'The latest SPORTX drops — fresh colourways, new technology and limited releases.',
    image: IMG.runSprint,
  },
  {
    key: 'sale',
    path: '/sale',
    title: 'Sale',
    eyebrow: 'Limited time',
    description: 'Premium performance gear at reduced prices. While stock lasts.',
    image: IMG.fbStadium,
  },
];

/** Department & category landing pages served at /categories/:slug. */
export const DEPARTMENT_COLLECTIONS: Collection[] = [
  {
    key: 'footwear',
    path: '/categories/footwear',
    title: 'Footwear',
    eyebrow: 'Engineered for performance',
    description: 'Boots, court shoes, runners and trainers designed around the demands of your sport.',
    image: IMG.shoeRedKnit,
  },
  {
    key: 'apparel',
    path: '/categories/apparel',
    title: 'Apparel',
    eyebrow: 'Built to move',
    description: 'Jerseys, tees, shorts, tracksuits and layers that keep you cool, dry and moving freely.',
    image: IMG.apTracksuit,
  },
  {
    key: 'accessories',
    path: '/categories/accessories',
    title: 'Accessories',
    eyebrow: 'The details matter',
    description: 'Bags, caps, socks, gloves and wearables to complete your kit.',
    image: IMG.acBackpackNavy,
  },
  {
    key: 'balls',
    path: '/categories/balls',
    title: 'Balls',
    eyebrow: 'Match ready',
    description: 'Football and basketball game balls built to competition specification.',
    image: IMG.fbBallsTrio,
  },
  {
    key: 'bags',
    path: '/categories/bags',
    title: 'Bags',
    eyebrow: 'Carry everything',
    description: 'Backpacks and packs with dedicated boot compartments and laptop sleeves.',
    image: IMG.acBackpackBlack,
  },
  {
    key: 'gym-equipment',
    path: '/categories/gym-equipment',
    title: 'Gym Equipment',
    eyebrow: 'Home or club',
    description: 'Dumbbells, bands, mats and conditioning tools for serious training anywhere.',
    image: IMG.trDumbbells,
  },
];

export const ALL_COLLECTIONS = [...COLLECTIONS, ...DEPARTMENT_COLLECTIONS];

export const getCollection = (key: string) => ALL_COLLECTIONS.find((c) => c.key === key);
