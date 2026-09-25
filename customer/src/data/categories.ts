import type { Category } from '@/types';
import { IMG } from './images';

/** Featured categories on the homepage and /categories. */
export const FEATURED_CATEGORIES: Category[] = [
  {
    slug: 'football',
    name: 'Football',
    description: 'Boots, balls & match kit',
    image: IMG.fbKickSky,
    href: '/football',
  },
  {
    slug: 'basketball',
    name: 'Basketball',
    description: 'Court shoes & game balls',
    image: IMG.bbDunk,
    href: '/basketball',
  },
  {
    slug: 'running',
    name: 'Running',
    description: 'Road, trail & race day',
    image: IMG.runSunset,
    href: '/running',
  },
  {
    slug: 'training',
    name: 'Training',
    description: 'Strength, HIIT & conditioning',
    image: IMG.trBarbell,
    href: '/training',
  },
  {
    slug: 'apparel',
    name: 'Apparel',
    description: 'Tees, tracksuits & layers',
    image: IMG.apTracksuit,
    href: '/categories/apparel',
  },
  {
    slug: 'equipment',
    name: 'Equipment',
    description: 'Balls, bags & gym gear',
    image: IMG.trDumbbellsMono,
    href: '/equipment',
  },
];

export const MORE_CATEGORIES: Category[] = [
  { slug: 'footwear', name: 'Footwear', description: 'Every sport, every surface', image: IMG.shoeWhiteAir, href: '/categories/footwear' },
  { slug: 'accessories', name: 'Accessories', description: 'Caps, socks & wearables', image: IMG.acCapModel, href: '/categories/accessories' },
  { slug: 'bags', name: 'Bags', description: 'Backpacks & packs', image: IMG.acBackpackGrey, href: '/categories/bags' },
  { slug: 'balls', name: 'Balls', description: 'Match & training balls', image: IMG.bbBallsPile, href: '/categories/balls' },
  { slug: 'gym-equipment', name: 'Gym Equipment', description: 'Home & club training', image: IMG.trBands, href: '/categories/gym-equipment' },
  { slug: 'kids', name: 'Kids', description: 'For young athletes', image: IMG.kidsJacket, href: '/kids' },
];
