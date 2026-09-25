import type { NavLink } from '@/types';
import { IMG } from './images';

export const MAIN_NAV: NavLink[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Men',
    href: '/men',
    mega: {
      columns: [
        {
          title: 'Footwear',
          links: [
            { label: 'Football Boots', href: '/men?category=football-boots' },
            { label: 'Basketball Shoes', href: '/men?category=basketball-shoes' },
            { label: 'Running Shoes', href: '/men?category=running-shoes' },
            { label: 'Training Shoes', href: '/men?category=training-shoes' },
            { label: 'Lifestyle', href: '/men?category=lifestyle-shoes' },
          ],
        },
        {
          title: 'Apparel',
          links: [
            { label: 'Jerseys', href: '/men?category=jerseys' },
            { label: 'T-Shirts & Tops', href: '/men?category=tees' },
            { label: 'Shorts', href: '/men?category=shorts' },
            { label: 'Tracksuits', href: '/men?category=tracksuits' },
            { label: 'Hoodies', href: '/men?category=hoodies' },
          ],
        },
        {
          title: 'Shop by Sport',
          links: [
            { label: 'Football', href: '/men?sport=football' },
            { label: 'Basketball', href: '/men?sport=basketball' },
            { label: 'Running', href: '/men?sport=running' },
            { label: 'Training', href: '/men?sport=training' },
          ],
        },
      ],
      feature: {
        title: 'Engineered for performance',
        subtitle: 'Shop men’s training',
        image: IMG.trCurl,
        href: '/men?sport=training',
      },
    },
  },
  {
    label: 'Women',
    href: '/women',
    mega: {
      columns: [
        {
          title: 'Footwear',
          links: [
            { label: 'Running Shoes', href: '/women?category=running-shoes' },
            { label: 'Training Shoes', href: '/women?category=training-shoes' },
            { label: 'Lifestyle', href: '/women?category=lifestyle-shoes' },
            { label: 'Basketball Shoes', href: '/women?category=basketball-shoes' },
          ],
        },
        {
          title: 'Apparel',
          links: [
            { label: 'Sports Bras', href: '/women?category=sports-bras' },
            { label: 'Leggings & Tights', href: '/women?category=leggings' },
            { label: 'Tracksuits', href: '/women?category=tracksuits' },
            { label: 'Jackets', href: '/women?category=jackets' },
            { label: 'Hoodies', href: '/women?category=hoodies' },
          ],
        },
        {
          title: 'Shop by Sport',
          links: [
            { label: 'Running', href: '/women?sport=running' },
            { label: 'Training', href: '/women?sport=training' },
            { label: 'Football', href: '/women?sport=football' },
            { label: 'Lifestyle', href: '/women?sport=lifestyle' },
          ],
        },
      ],
      feature: {
        title: 'Strength in motion',
        subtitle: 'Shop women’s running',
        image: IMG.runLeggings,
        href: '/women?sport=running',
      },
    },
  },
  { label: 'Kids', href: '/kids' },
  { label: 'Football', href: '/football' },
  { label: 'Basketball', href: '/basketball' },
  { label: 'Training', href: '/training' },
  { label: 'Equipment', href: '/equipment' },
  { label: 'New Arrivals', href: '/new-arrivals' },
  { label: 'Sale', href: '/sale', highlight: true },
];

export const FOOTER_NAV = {
  shop: [
    { label: 'Men', href: '/men' },
    { label: 'Women', href: '/women' },
    { label: 'Kids', href: '/kids' },
    { label: 'Football', href: '/football' },
    { label: 'Basketball', href: '/basketball' },
    { label: 'Training', href: '/training' },
    { label: 'Equipment', href: '/equipment' },
    { label: 'New Arrivals', href: '/new-arrivals' },
    { label: 'Sale', href: '/sale' },
  ],
  customer: [
    { label: 'My Account', href: '/account' },
    { label: 'Orders', href: '/account/orders' },
    { label: 'Wishlist', href: '/wishlist' },
    { label: 'Shipping', href: '/shipping' },
    { label: 'Returns', href: '/returns' },
    { label: 'Contact', href: '/contact' },
    { label: 'FAQ', href: '/faq' },
  ],
  company: [
    { label: 'About SPORTX', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
};

export const POPULAR_SEARCHES = [
  'Football boots',
  'Running shoes',
  'Match football',
  'Training tee',
  'Tracksuit',
  'Backpack',
  'Basketball',
];
