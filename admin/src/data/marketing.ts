import type { Campaign, Coupon, Discount, FlashSale } from '@/types';
import { products } from './catalog';
import { daysAgo, daysFromNow } from './seed';

const pid = (...ns: number[]) => ns.map((n) => `prd_${n}`);

type CouponDef = Omit<Coupon, 'id' | 'createdAt' | 'categoryIds' | 'productIds' | 'customerGroups'> & Partial<Pick<Coupon, 'categoryIds' | 'productIds' | 'customerGroups'>>;

const COUPONS: CouponDef[] = [
  { code: 'WELCOME10', description: '10% off first order', type: 'percentage', value: 10, minOrder: 10000, maxDiscount: 5000, usageLimit: undefined, perCustomerLimit: 1, usageCount: 184, startsAt: daysAgo(240), endsAt: undefined, enabled: true, customerGroups: ['new'] },
  { code: 'MATCHDAY15', description: '15% off football boots and balls', type: 'percentage', value: 15, minOrder: 15000, maxDiscount: 8000, usageLimit: 300, perCustomerLimit: 2, usageCount: 212, startsAt: daysAgo(40), endsAt: daysFromNow(20), enabled: true, categoryIds: ['cat_football', 'cat_football-boots'] },
  { code: 'RUNCLUB', description: '10% off running footwear', type: 'percentage', value: 10, minOrder: 0, usageLimit: 150, perCustomerLimit: 1, usageCount: 97, startsAt: daysAgo(60), endsAt: daysFromNow(30), enabled: true, categoryIds: ['cat_running'] },
  { code: 'HOOPS2000', description: 'DJF 2,000 off basketball shoes', type: 'fixed', value: 2000, minOrder: 15000, usageLimit: 100, perCustomerLimit: 1, usageCount: 41, startsAt: daysAgo(15), endsAt: daysFromNow(45), enabled: true, categoryIds: ['cat_basketball'] },
  { code: 'VIP20', description: '20% for high-value customers', type: 'percentage', value: 20, minOrder: 30000, maxDiscount: 15000, usageLimit: 50, perCustomerLimit: 3, usageCount: 18, startsAt: daysAgo(30), endsAt: daysFromNow(60), enabled: true, customerGroups: ['high_value'] },
  { code: 'COMEBACK', description: 'Win-back offer for inactive customers', type: 'fixed', value: 3000, minOrder: 12000, usageLimit: 200, perCustomerLimit: 1, usageCount: 23, startsAt: daysAgo(10), endsAt: daysFromNow(50), enabled: true, customerGroups: ['inactive'] },
  { code: 'TEAMKIT', description: '12% off jerseys and shorts', type: 'percentage', value: 12, minOrder: 40000, usageLimit: 40, perCustomerLimit: 2, usageCount: 9, startsAt: daysAgo(5), endsAt: daysFromNow(85), enabled: true, categoryIds: ['cat_jerseys', 'cat_apparel'] },
  { code: 'INDEPENDENCE', description: 'Independence Day special — 27 June', type: 'percentage', value: 27, minOrder: 20000, maxDiscount: 12000, usageLimit: 500, perCustomerLimit: 1, usageCount: 500, startsAt: daysAgo(95), endsAt: daysAgo(88), enabled: true },
  { code: 'RAMADAN15', description: 'Ramadan offer', type: 'percentage', value: 15, minOrder: 10000, usageLimit: 400, perCustomerLimit: 1, usageCount: 361, startsAt: daysAgo(210), endsAt: daysAgo(180), enabled: true },
  { code: 'BACK2SCHOOL', description: 'Kids boots and bags', type: 'fixed', value: 1500, minOrder: 8000, usageLimit: 250, perCustomerLimit: 2, usageCount: 138, startsAt: daysAgo(35), endsAt: daysAgo(2), enabled: true, categoryIds: ['cat_kids', 'cat_bags'] },
  { code: 'GYM5000', description: 'DJF 5,000 off gym equipment over 25k', type: 'fixed', value: 5000, minOrder: 25000, usageLimit: 60, perCustomerLimit: 1, usageCount: 0, startsAt: daysFromNow(7), endsAt: daysFromNow(37), enabled: true, categoryIds: ['cat_gym-equipment'] },
  { code: 'BLACKFRIDAY', description: 'Black Friday sitewide', type: 'percentage', value: 25, minOrder: 15000, maxDiscount: 20000, usageLimit: 1000, perCustomerLimit: 1, usageCount: 0, startsAt: daysFromNow(62), endsAt: daysFromNow(66), enabled: true },
  { code: 'STAFF30', description: 'Staff purchase programme', type: 'percentage', value: 30, minOrder: 0, maxDiscount: 25000, usageLimit: undefined, perCustomerLimit: 5, usageCount: 12, startsAt: daysAgo(300), enabled: false },
  { code: 'FREESOCKS', description: 'DJF 1,900 off — one pair of Milano socks', type: 'fixed', value: 1900, minOrder: 20000, usageLimit: 100, perCustomerLimit: 1, usageCount: 64, startsAt: daysAgo(20), endsAt: daysFromNow(10), enabled: false, productIds: pid(1038) },
];

export const coupons: Coupon[] = COUPONS.map((c, i) => ({
  categoryIds: [],
  productIds: [],
  customerGroups: [],
  ...c,
  id: `cpn_${String(i + 1).padStart(3, '0')}`,
  createdAt: c.startsAt < daysAgo(1) ? daysAgo(Math.max(1, Math.round((Date.now() - new Date(c.startsAt).getTime()) / 86_400_000) + 3)) : daysAgo(2),
}));

export const discounts: Discount[] = [
  { id: 'dsc_001', name: 'End of season — tracksuits', type: 'percentage', value: 20, appliesTo: 'categories', targetIds: ['cat_tracksuits'], startsAt: daysAgo(12), endsAt: daysFromNow(18), enabled: true, createdAt: daysAgo(14) },
  { id: 'dsc_002', name: 'Puma football boots', type: 'percentage', value: 10, appliesTo: 'brands', targetIds: ['brd_puma'], startsAt: daysAgo(6), endsAt: daysFromNow(24), enabled: true, createdAt: daysAgo(7) },
  { id: 'dsc_003', name: 'Bundle — socks', type: 'fixed', value: 500, appliesTo: 'products', targetIds: pid(1037, 1038, 1039), startsAt: daysAgo(30), endsAt: undefined, enabled: true, createdAt: daysAgo(31) },
  { id: 'dsc_004', name: 'Archive clearance', type: 'percentage', value: 35, appliesTo: 'products', targetIds: pid(1052), startsAt: daysAgo(80), endsAt: daysAgo(20), enabled: true, createdAt: daysAgo(82) },
  { id: 'dsc_005', name: 'Gym week', type: 'percentage', value: 15, appliesTo: 'categories', targetIds: ['cat_gym-equipment'], startsAt: daysFromNow(14), endsAt: daysFromNow(21), enabled: true, createdAt: daysAgo(1) },
  { id: 'dsc_006', name: 'Sitewide 5% (paused)', type: 'percentage', value: 5, appliesTo: 'all', targetIds: [], startsAt: daysAgo(50), endsAt: undefined, enabled: false, createdAt: daysAgo(52) },
];

export const flashSales: FlashSale[] = [
  { id: 'fls_001', name: 'Friday Boot Drop', discountPercent: 25, productIds: pid(1001, 1002, 1003, 1004), startsAt: daysAgo(0, 8), endsAt: daysFromNow(1, 0), enabled: true, unitsSold: 23, revenue: 612_000, createdAt: daysAgo(4) },
  { id: 'fls_002', name: 'Weekend Running Sale', discountPercent: 20, productIds: pid(1012, 1013, 1014, 1015, 1026), startsAt: daysFromNow(1, 8), endsAt: daysFromNow(3, 23), enabled: true, unitsSold: 0, revenue: 0, createdAt: daysAgo(2) },
  { id: 'fls_003', name: 'Hoops Night', discountPercent: 30, productIds: pid(1007, 1008, 1009, 1045, 1046), startsAt: daysFromNow(9, 18), endsAt: daysFromNow(10, 2), enabled: true, unitsSold: 0, revenue: 0, createdAt: daysAgo(1) },
  { id: 'fls_004', name: 'Gym Starter Pack', discountPercent: 15, productIds: pid(1047, 1048, 1049, 1050, 1042), startsAt: daysAgo(12, 8), endsAt: daysAgo(10, 23), enabled: true, unitsSold: 41, revenue: 238_000, createdAt: daysAgo(15) },
  { id: 'fls_005', name: 'Jersey Flash — Club Colours', discountPercent: 20, productIds: pid(1022, 1023, 1024), startsAt: daysAgo(26, 10), endsAt: daysAgo(25, 22), enabled: true, unitsSold: 57, revenue: 342_000, createdAt: daysAgo(29) },
];

export const campaigns: Campaign[] = [
  { id: 'cmp_001', name: 'New Season Football 2026/27', type: 'football', description: 'Launch of the new season boot collection and match balls.', productIds: pid(1001, 1002, 1003, 1043, 1044), categoryIds: ['cat_football-boots'], startsAt: daysAgo(18), endsAt: daysFromNow(40), status: 'active', impressions: 48_200, clicks: 2_930, revenue: 1_845_000, createdAt: daysAgo(25), updatedAt: daysAgo(2) },
  { id: 'cmp_002', name: 'Run Djibouti — Autumn', type: 'seasonal', description: 'Running footwear and apparel for the cooler months.', productIds: pid(1012, 1013, 1014, 1015, 1016, 1026), categoryIds: ['cat_running'], startsAt: daysFromNow(6), endsAt: daysFromNow(60), status: 'scheduled', impressions: 0, clicks: 0, revenue: 0, createdAt: daysAgo(5), updatedAt: daysAgo(1) },
  { id: 'cmp_003', name: 'Court Kings — Basketball', type: 'basketball', description: 'Signature basketball shoes and game balls.', productIds: pid(1007, 1008, 1009, 1010, 1045), categoryIds: ['cat_basketball'], startsAt: daysAgo(30), endsAt: daysFromNow(10), status: 'active', impressions: 31_450, clicks: 1_720, revenue: 986_500, createdAt: daysAgo(34), updatedAt: daysAgo(3) },
  { id: 'cmp_004', name: 'Train Hard — Gym Essentials', type: 'training', description: 'Equipment and training apparel for home and gym.', productIds: pid(1018, 1019, 1020, 1047, 1048), categoryIds: ['cat_training', 'cat_gym-equipment'], startsAt: daysAgo(10), endsAt: daysFromNow(20), status: 'paused', impressions: 12_880, clicks: 540, revenue: 214_000, createdAt: daysAgo(12), updatedAt: daysAgo(1) },
  { id: 'cmp_005', name: 'Summer Clearance', type: 'clearance', description: 'Final reductions on summer lines.', productIds: pid(1051, 1052, 1032), categoryIds: [], startsAt: daysAgo(90), endsAt: daysAgo(45), status: 'ended', impressions: 64_300, clicks: 3_880, revenue: 2_310_000, createdAt: daysAgo(95), updatedAt: daysAgo(45) },
  { id: 'cmp_006', name: 'Mercurial Elite — Limited Drop', type: 'limited_release', description: 'Limited colourway release with in-store launch at Place Menelik.', productIds: pid(1001), categoryIds: [], startsAt: daysFromNow(21), endsAt: daysFromNow(28), status: 'draft', impressions: 0, clicks: 0, revenue: 0, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  { id: 'cmp_007', name: 'New Arrivals — Autumn Drop', type: 'new_arrivals', description: 'Latest arrivals across running and training.', productIds: pid(1013, 1015, 1030, 1031), categoryIds: [], startsAt: daysAgo(4), endsAt: daysFromNow(26), status: 'active', impressions: 9_640, clicks: 710, revenue: 402_000, createdAt: daysAgo(6), updatedAt: daysAgo(1) },
  { id: 'cmp_008', name: 'Back to School 2026', type: 'seasonal', description: 'Kids boots, bags and tracksuits.', productIds: pid(1006, 1025, 1033, 1035), categoryIds: ['cat_kids'], startsAt: daysAgo(45), endsAt: daysAgo(2), status: 'archived', impressions: 22_100, clicks: 1_310, revenue: 688_000, createdAt: daysAgo(50), updatedAt: daysAgo(2) },
];

/** Keep product references valid if the catalogue changes. */
export const knownProductIds = new Set(products.map((p) => p.id));
