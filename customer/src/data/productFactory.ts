import type {
  Department,
  Gender,
  Product,
  ProductBadge,
  ProductCategory,
  ProductColor,
  ProductSpecification,
  ProductVariant,
  SizeGuideType,
  Sport,
} from '@/types';
import { IMG, type ImageKey } from './images';

export const SIZES = {
  footwear: ['39', '40', '41', '42', '43', '44', '45', '46'],
  footwearWomen: ['36', '37', '38', '39', '40', '41', '42'],
  footwearKids: ['28', '30', '32', '34', '35', '36'],
  apparel: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  apparelKids: ['4-5Y', '6-7Y', '8-9Y', '10-11Y', '12-13Y'],
  gloves: ['S', 'M', 'L', 'XL'],
  football: ['Size 3', 'Size 4', 'Size 5'],
  basketball: ['Size 5', 'Size 6', 'Size 7'],
  socks: ['35-38', '39-42', '43-46'],
  oneSize: ['One Size'],
} as const;

/**
 * - healthy: most variants well stocked
 * - low: scarce across the board (triggers "Only X left")
 * - out: sold out everywhere
 */
export type StockProfile = 'healthy' | 'low' | 'out';

export interface ProductSeed {
  id: string;
  name: string;
  brand: string;
  department: Department;
  category: ProductCategory;
  sport: Sport;
  gender: Gender[];
  shortDescription: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviewCount: number;
  images: [ImageKey, string][];
  colors: ProductColor[];
  sizes: readonly string[];
  stockProfile?: StockProfile;
  features: string[];
  specifications: ProductSpecification[];
  badge?: ProductBadge;
  isNew?: boolean;
  isBestSeller?: boolean;
  popularity: number;
  createdAt: string;
  sizeGuide: SizeGuideType;
  tags?: string[];
  completeTheLook?: string[];
}

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');

/** Small deterministic PRNG so mock stock is identical on every load. */
function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildVariants(seed: ProductSeed): ProductVariant[] {
  const rand = seededRandom(seed.id);
  const profile = seed.stockProfile ?? 'healthy';
  const skuBase = seed.id.toUpperCase();

  return seed.colors.flatMap((color, ci) =>
    seed.sizes.map((size, si) => {
      let stock = 0;
      if (profile === 'healthy') {
        const r = rand();
        stock = r < 0.1 ? 0 : r < 0.22 ? 1 + Math.floor(rand() * 4) : 6 + Math.floor(rand() * 20);
      } else if (profile === 'low') {
        stock = rand() < 0.45 ? 0 : 1 + Math.floor(rand() * 3);
      }
      return {
        id: `${seed.id}-${ci}-${si}`,
        sku: `${skuBase}-${slugify(color.name).toUpperCase()}-${slugify(size).toUpperCase()}`,
        color: color.name,
        size,
        stock,
      };
    }),
  );
}

export function defineProduct(seed: ProductSeed): Product {
  const variants = buildVariants(seed);
  return {
    id: seed.id,
    slug: slugify(seed.name),
    name: seed.name,
    brand: seed.brand,
    department: seed.department,
    category: seed.category,
    sport: seed.sport,
    gender: seed.gender,
    shortDescription: seed.shortDescription,
    description: seed.description,
    price: seed.price,
    compareAtPrice: seed.compareAtPrice,
    rating: seed.rating,
    reviewCount: seed.reviewCount,
    images: seed.images.map(([key, alt]) => ({ url: IMG[key], alt })),
    colors: seed.colors,
    sizes: [...seed.sizes],
    variants,
    stock: variants.reduce((sum, v) => sum + v.stock, 0),
    features: seed.features,
    specifications: seed.specifications,
    badge: seed.badge,
    isNew: seed.isNew ?? false,
    isBestSeller: seed.isBestSeller ?? false,
    popularity: seed.popularity,
    createdAt: seed.createdAt,
    sizeGuide: seed.sizeGuide,
    tags: seed.tags ?? [],
    completeTheLook: seed.completeTheLook,
  };
}
