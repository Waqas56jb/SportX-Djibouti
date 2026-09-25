import type { Product, Review } from '@/types';

const AUTHORS = [
  'Ahmed K.', 'Fatouma A.', 'Hassan D.', 'Amina Y.', 'Ibrahim M.', 'Samira H.', 'Omar B.', 'Hodan I.',
  'Abdourahman S.', 'Yasmin O.', 'Moussa R.', 'Nasra F.', 'Kadar E.', 'Ilhan G.', 'Daher W.', 'Zahra N.',
];

type Template = Pick<Review, 'title' | 'body' | 'rating' | 'fit'>;

const TEMPLATES: Record<Product['department'], Template[]> = {
  footwear: [
    { rating: 5, title: 'Best pair I have owned', body: 'Locked in from the first session. Cushioning feels responsive without being mushy, and they still look new after a month of heavy use.', fit: 'true' },
    { rating: 5, title: 'Worth every franc', body: 'Light, supportive and they breathe really well in the heat. I noticed the difference in my first session.', fit: 'true' },
    { rating: 4, title: 'Great, but size up half', body: 'Performance is excellent. The fit is a little snug across the forefoot, so I would go half a size up if you have wider feet.', fit: 'small' },
    { rating: 4, title: 'Solid all-rounder', body: 'Comfortable straight out of the box. Grip is strong and the upper holds its shape. Took a couple of sessions to fully break in.', fit: 'true' },
    { rating: 5, title: 'Game changer', body: 'Quick, stable and the traction is unreal. Teammates keep asking where I got them.', fit: 'true' },
    { rating: 3, title: 'Good quality, runs large', body: 'Build quality is clearly premium but they run slightly big. Exchanged for a smaller size in store with no issues.', fit: 'large' },
  ],
  apparel: [
    { rating: 5, title: 'Stays dry all session', body: 'Fabric is light and wicks sweat fast, even outdoors in the afternoon heat. Fit is athletic without being tight.', fit: 'true' },
    { rating: 4, title: 'Premium feel', body: 'Stitching and fabric quality are excellent. Washes well with no shrinking. I would order one size down for a slimmer fit.', fit: 'large' },
    { rating: 5, title: 'My new favourite', body: 'Comfortable enough to wear all day and technical enough for training. Already ordered a second colour.', fit: 'true' },
    { rating: 4, title: 'Great fit and colour', body: 'Colour is exactly as pictured and the cut is flattering. Would love more colour options.', fit: 'true' },
    { rating: 5, title: 'Top quality', body: 'You can feel the difference compared to cheaper sportswear. Moves with you and does not cling.', fit: 'true' },
  ],
  equipment: [
    { rating: 5, title: 'Club quality', body: 'We ordered these for our academy and the quality is consistent across the whole batch. Holds up to daily use.' },
    { rating: 5, title: 'Exactly what I needed', body: 'Solid construction, great finish and arrived quickly. Would buy again.' },
    { rating: 4, title: 'Very good value', body: 'Well made and does the job perfectly. Only wish it came with a carry bag.' },
    { rating: 4, title: 'Durable', body: 'Months of use and still in excellent condition. Recommended for anyone training regularly.' },
  ],
  accessories: [
    { rating: 5, title: 'Built to last', body: 'Materials feel premium and everything is thoughtfully designed. I use it every day.' },
    { rating: 4, title: 'Great everyday piece', body: 'Looks sharp and works well. Minor quibble on colour being slightly darker than photos.' },
    { rating: 5, title: 'Highly recommend', body: 'Great quality for the price and it has become part of my daily kit.' },
    { rating: 4, title: 'Does the job', body: 'Well made and practical. Delivery was quick too.' },
  ],
};

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic sample of reviews for a product (the latest few shown on PDP). */
export function generateProductReviews(product: Product): Review[] {
  const pool = TEMPLATES[product.department];
  const seed = hash(product.id);
  const count = 4 + (seed % 4);
  const base = new Date(product.createdAt).getTime();

  return Array.from({ length: count }, (_, i) => {
    const template = pool[(seed + i) % pool.length];
    // Nudge ratings so the sample mirrors the product's overall score.
    const rating = product.rating >= 4.7 && template.rating < 4 ? 5 : template.rating;
    const size = product.sizes.length > 1 ? product.sizes[(seed + i) % product.sizes.length] : undefined;
    return {
      id: `${product.id}-r${i}`,
      productId: product.id,
      userId: null,
      author: AUTHORS[(seed + i * 3) % AUTHORS.length],
      rating,
      title: template.title,
      body: template.body,
      createdAt: new Date(Math.min(base + (i + 1) * 6 * 86400000, Date.now() - (i + 1) * 43200000)).toISOString(),
      verified: i % 3 !== 2,
      size,
      fit: template.fit,
    };
  });
}
