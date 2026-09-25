import { t } from '@/i18n';
import type { NavLink } from '@/types';
import { IMG } from './images';

const cat = (slug: 'football-boots' | 'turf-shoes' | 'jerseys' | 'team-kits' | 'polo-shirts' | 't-shirts' | 'shorts' | 'tracksuits' | 'socks' | 'bags' | 'goalkeeper-gloves' | 'balls') => ({
  label: t(`common.category.${slug}`),
  href: `/categories/${slug}`,
});

/** Main navigation. A function so labels follow the selected language. `key` is language-independent. */
export const getMainNav = (): NavLink[] => [
  {
    key: 'football',
    label: t('layout.nav.football'),
    href: '/football',
    mega: {
      columns: [
        { title: t('layout.nav.colFootwear'), links: [cat('football-boots'), cat('turf-shoes')] },
        { title: t('layout.nav.colTeamwear'), links: [cat('jerseys'), cat('team-kits'), cat('shorts'), cat('socks')] },
        { title: t('layout.nav.colEquipment'), links: [cat('balls'), cat('goalkeeper-gloves'), cat('bags')] },
      ],
      feature: {
        title: t('layout.nav.featureFootballTitle'),
        subtitle: t('layout.nav.featureFootballSub'),
        image: IMG.bootsOrangeCorner,
        href: '/categories/football-boots',
      },
    },
  },
  {
    key: 'clothing',
    label: t('layout.nav.clothing'),
    href: '/categories/apparel',
    mega: {
      columns: [
        { title: t('layout.nav.colTops'), links: [cat('polo-shirts'), cat('t-shirts'), cat('jerseys')] },
        { title: t('layout.nav.colTraining'), links: [cat('tracksuits'), cat('shorts'), cat('team-kits')] },
        { title: t('layout.nav.colAccessories'), links: [cat('socks'), cat('bags')] },
      ],
      feature: {
        title: t('layout.nav.featureClothingTitle'),
        subtitle: t('layout.nav.featureClothingSub'),
        image: IMG.poloModel,
        href: '/categories/polo-shirts',
      },
    },
  },
  { key: 'boots', label: t('layout.nav.boots'), href: '/categories/football-boots' },
  { key: 'kits', label: t('layout.nav.teamKits'), href: '/categories/team-kits' },
  { key: 'polos', label: t('layout.nav.polos'), href: '/categories/polo-shirts' },
  { key: 'bags', label: t('layout.nav.bags'), href: '/categories/bags' },
  { key: 'new', label: t('layout.nav.newArrivals'), href: '/new-arrivals' },
  { key: 'sale', label: t('layout.nav.sale'), href: '/sale', highlight: true },
];

export const getFooterNav = () => ({
  shop: [
    { label: t('layout.nav.football'), href: '/football' },
    cat('football-boots'),
    cat('team-kits'),
    cat('jerseys'),
    cat('polo-shirts'),
    cat('t-shirts'),
    cat('socks'),
    cat('bags'),
    { label: t('layout.nav.newArrivals'), href: '/new-arrivals' },
    { label: t('layout.nav.sale'), href: '/sale' },
  ],
  customer: [
    { label: t('layout.footer.myAccount'), href: '/account' },
    { label: t('layout.footer.orders'), href: '/account/orders' },
    { label: t('layout.footer.wishlist'), href: '/wishlist' },
    { label: t('layout.footer.shipping'), href: '/shipping' },
    { label: t('layout.footer.returns'), href: '/returns' },
    { label: t('layout.footer.contact'), href: '/contact' },
    { label: t('layout.footer.faq'), href: '/faq' },
  ],
  company: [
    { label: t('layout.footer.about', { name: 'SPORTX' }), href: '/about' },
    { label: t('layout.footer.ourCeo'), href: '/about#ceo' },
    { label: t('layout.footer.contact'), href: '/contact' },
    { label: t('layout.footer.privacy'), href: '/privacy' },
    { label: t('layout.footer.terms'), href: '/terms' },
  ],
});

export const getPopularSearches = () => t('layout.search.popular').split('|');
