import type { Brand, Category, Gender, Product, ProductType, ProductVariant, Sport } from '@/types';
import { COLORS, colorByName } from '@/constants/catalog';
import { slugify } from '@/utils/format';
import { createRng, daysAgo } from './seed';
import { productArt } from './productArt';

const rng = createRng(20260925);

// ─── Brands ──────────────────────────────────────────────────────────────────
const BRAND_DEFS: [string, string, string][] = [
  ['Nike', 'https://www.nike.com', 'Performance footwear, apparel and equipment across football, basketball, running and training.'],
  ['Adidas', 'https://www.adidas.com', 'Football, running and training performance products and team apparel.'],
  ['Puma', 'https://www.puma.com', 'Football boots, teamwear and training essentials.'],
  ['Under Armour', 'https://www.underarmour.com', 'Performance training apparel, basketball footwear and bags.'],
  ['New Balance', 'https://www.newbalance.com', 'Premium running footwear.'],
  ['Asics', 'https://www.asics.com', 'Stability and cushioned running shoes.'],
  ['Molten', 'https://www.molten.co.jp', 'Official match balls for basketball and volleyball.'],
  ['Wilson', 'https://www.wilson.com', 'Basketballs and sports equipment.'],
  ['Reebok', 'https://www.reebok.com', 'Gym and fitness equipment and training apparel.'],
  ['Mizuno', 'https://www.mizuno.com', 'Running and football footwear.'],
];

export const brands: Brand[] = BRAND_DEFS.map(([name, website, description], i) => ({
  id: `brd_${slugify(name)}`,
  name,
  slug: slugify(name),
  description,
  website,
  status: name === 'Mizuno' ? 'inactive' : 'active',
  productCount: 0,
  createdAt: daysAgo(400 - i * 3),
  updatedAt: daysAgo(30 - i),
}));

// ─── Categories ─────────────────────────────────────────────────────────────
type CatDef = [slug: string, name: string, parent: string | null, description: string];
const CATEGORY_DEFS: CatDef[] = [
  ['men', 'Men', null, 'Performance footwear, apparel and accessories for men.'],
  ['women', 'Women', null, 'Performance footwear, apparel and accessories for women.'],
  ['kids', 'Kids', null, 'Sportswear and boots sized for young athletes.'],
  ['football', 'Football', null, 'Boots, balls, goalkeeper gear and match essentials.'],
  ['football-boots', 'Football Boots', 'football', 'Firm ground, artificial grass and turf boots.'],
  ['basketball', 'Basketball', null, 'Basketball shoes, balls and on-court apparel.'],
  ['running', 'Running', null, 'Road running shoes and running apparel.'],
  ['training', 'Training', null, 'Gym tops, gloves and training essentials.'],
  ['equipment', 'Equipment', null, 'Gym equipment, bags and accessories.'],
  ['gym-equipment', 'Gym Equipment', 'equipment', 'Dumbbells, mats, bands and conditioning tools.'],
  ['bags', 'Bags', 'equipment', 'Duffels and backpacks for training and match days.'],
  ['apparel', 'Apparel', null, 'Jerseys, shorts, tracksuits and socks.'],
  ['jerseys', 'Jerseys', 'apparel', 'Match and training jerseys.'],
  ['tracksuits', 'Tracksuits', 'apparel', 'Full tracksuits for training and travel.'],
];

export const categories: Category[] = CATEGORY_DEFS.map(([slug, name, parent, description], i) => ({
  id: `cat_${slug}`,
  name,
  slug,
  description,
  parentId: parent ? `cat_${parent}` : null,
  status: 'active',
  position: i,
  productCount: 0,
  seoTitle: `${name} | SPORTX Djibouti`,
  seoDescription: description,
  createdAt: daysAgo(420 - i),
  updatedAt: daysAgo(20 + i),
}));

// ─── Products ───────────────────────────────────────────────────────────────
const SIZES = {
  men: ['39', '40', '41', '42', '43', '44'],
  women: ['36', '37', '38', '39', '40', '41'],
  kids: ['30', '32', '34', '36'],
  apparel: ['S', 'M', 'L', 'XL', 'XXL'],
  kidsApparel: ['6-8Y', '8-10Y', '10-12Y', '12-14Y'],
  socks: ['S (34-38)', 'M (38-42)', 'L (42-46)'],
  gloves: ['8', '9', '10'],
  football: ['4', '5'],
  basketball: ['6', '7'],
  one: ['One Size'],
  dumbbell: ['2 x 5 kg', '2 x 10 kg', '2 x 15 kg'],
};

interface Def {
  name: string;
  brand: string;
  type: ProductType;
  sport: Sport;
  gender: Gender;
  price: number;
  compareAt?: number;
  category: string;
  colors: string[];
  sizes: string[];
  status?: Product['status'];
  short: string;
  specs: [string, string][];
}

const DEFS: Def[] = [
  // Football boots
  { name: 'Nike Mercurial Vapor 15 Elite FG', brand: 'Nike', type: 'footwear', sport: 'football', gender: 'men', price: 44500, compareAt: 49000, category: 'football-boots', colors: ['Black', 'Volt'], sizes: SIZES.men, short: 'Lightweight speed boot with Flyknit upper for firm ground.', specs: [['Surface', 'Firm Ground (FG)'], ['Upper', 'Flyknit with All Conditions Control'], ['Weight', '185 g (size 42)']] },
  { name: 'Adidas Predator Elite FG', brand: 'Adidas', type: 'footwear', sport: 'football', gender: 'men', price: 42000, category: 'football-boots', colors: ['Black', 'White', 'Red'], sizes: SIZES.men, short: 'Control boot with Strikeskin rubber fins for grip on the ball.', specs: [['Surface', 'Firm Ground (FG)'], ['Upper', 'Hybridtouch 2.0'], ['Closure', 'Laceless fold-over tongue']] },
  { name: 'Puma Future 7 Pro FG/AG', brand: 'Puma', type: 'footwear', sport: 'football', gender: 'men', price: 29500, category: 'football-boots', colors: ['Black', 'Orange'], sizes: SIZES.men, short: 'Adaptive FUZIONFIT360 knit for agile playmakers.', specs: [['Surface', 'Firm / Artificial Ground'], ['Upper', 'FUZIONFIT360 knit']] },
  { name: 'Nike Phantom GX 2 Academy TF', brand: 'Nike', type: 'footwear', sport: 'football', gender: 'men', price: 16900, category: 'football-boots', colors: ['Black', 'White'], sizes: SIZES.men, short: 'Turf boot built for small-sided games on artificial pitches.', specs: [['Surface', 'Turf (TF)'], ['Upper', 'Synthetic with Gripknit zone']] },
  { name: 'Adidas Copa Pure 2 League FG', brand: 'Adidas', type: 'footwear', sport: 'football', gender: 'men', price: 15500, category: 'football-boots', colors: ['White', 'Black'], sizes: SIZES.men, short: 'Classic leather-feel touch with modern comfort.', specs: [['Surface', 'Firm Ground (FG)'], ['Upper', 'Synthetic leather']] },
  { name: 'Nike Mercurial Superfly 10 Club Kids MG', brand: 'Nike', type: 'footwear', sport: 'football', gender: 'kids', price: 8900, category: 'football-boots', colors: ['Black', 'Pink'], sizes: SIZES.kids, short: 'Multi-ground boot for young players.', specs: [['Surface', 'Multi-Ground (MG)'], ['Collar', 'Dynamic Fit']] },
  // Basketball shoes
  { name: 'Nike LeBron XXI', brand: 'Nike', type: 'footwear', sport: 'basketball', gender: 'men', price: 36000, category: 'basketball', colors: ['Black', 'White'], sizes: SIZES.men, short: 'Signature LeBron cushioning with Zoom Turbo unit.', specs: [['Cushioning', 'Zoom Turbo + Air Zoom'], ['Cut', 'Low']] },
  { name: 'Under Armour Curry 11', brand: 'Under Armour', type: 'footwear', sport: 'basketball', gender: 'men', price: 33500, category: 'basketball', colors: ['White', 'Navy'], sizes: SIZES.men, short: 'UA Flow cushioning for grip and court feel.', specs: [['Cushioning', 'UA Flow'], ['Cut', 'Mid']] },
  { name: 'Adidas Dame 9', brand: 'Adidas', type: 'footwear', sport: 'basketball', gender: 'men', price: 22000, category: 'basketball', colors: ['Black', 'Red'], sizes: SIZES.men, short: 'Bounce Pro cushioning for quick guards.', specs: [['Cushioning', 'Bounce Pro'], ['Cut', 'Low']] },
  { name: 'Puma MB.03', brand: 'Puma', type: 'footwear', sport: 'basketball', gender: 'men', price: 24500, category: 'basketball', colors: ['Orange', 'Black'], sizes: SIZES.men, short: 'Nitro foam and bold design for explosive play.', specs: [['Cushioning', 'Nitro Foam'], ['Cut', 'Mid']] },
  { name: 'Nike Giannis Immortality 4', brand: 'Nike', type: 'footwear', sport: 'basketball', gender: 'men', price: 15900, category: 'basketball', colors: ['Black', 'White'], sizes: SIZES.men, short: 'Lightweight, stable court shoe at an accessible price.', specs: [['Cushioning', 'Foam midsole'], ['Cut', 'Low']] },
  // Running
  { name: 'Asics Gel-Kayano 31', brand: 'Asics', type: 'footwear', sport: 'running', gender: 'men', price: 30000, category: 'running', colors: ['Black', 'Navy'], sizes: SIZES.men, short: 'Stability trainer with 4D Guidance System.', specs: [['Drop', '10 mm'], ['Support', 'Stability']] },
  { name: 'Nike Pegasus 41', brand: 'Nike', type: 'footwear', sport: 'running', gender: 'men', price: 24900, category: 'running', colors: ['Black', 'White', 'Volt'], sizes: SIZES.men, short: 'Everyday road trainer with ReactX foam.', specs: [['Drop', '10 mm'], ['Support', 'Neutral']] },
  { name: 'New Balance Fresh Foam X 1080v14', brand: 'New Balance', type: 'footwear', sport: 'running', gender: 'men', price: 31500, category: 'running', colors: ['Grey', 'Black'], sizes: SIZES.men, short: 'Max cushioning for long runs.', specs: [['Drop', '6 mm'], ['Support', 'Neutral']] },
  { name: 'Adidas Ultraboost 5', brand: 'Adidas', type: 'footwear', sport: 'running', gender: 'unisex', price: 32000, compareAt: 35500, category: 'running', colors: ['Black', 'White'], sizes: SIZES.men, short: 'Light BOOST cushioning with a Primeknit upper.', specs: [['Drop', '10 mm'], ['Cushioning', 'Light BOOST']] },
  { name: "Asics Gel-Nimbus 26 Women's", brand: 'Asics', type: 'footwear', sport: 'running', gender: 'women', price: 28500, category: 'running', colors: ['Pink', 'White'], sizes: SIZES.women, short: 'Plush cushioning designed for women runners.', specs: [['Drop', '8 mm'], ['Support', 'Neutral']] },
  { name: "Nike Revolution 7 Women's", brand: 'Nike', type: 'footwear', sport: 'running', gender: 'women', price: 11500, category: 'running', colors: ['White', 'Pink'], sizes: SIZES.women, short: 'Soft, everyday running shoe.', specs: [['Drop', '10 mm'], ['Support', 'Neutral']] },
  // Training tops
  { name: 'Nike Dri-FIT Academy 23 Top', brand: 'Nike', type: 'apparel', sport: 'training', gender: 'men', price: 5900, category: 'training', colors: ['Black', 'White', 'Royal Blue', 'Red'], sizes: SIZES.apparel, short: 'Sweat-wicking training top for daily sessions.', specs: [['Fabric', '100% recycled polyester'], ['Fit', 'Standard']] },
  { name: 'Adidas Train Essentials Tee', brand: 'Adidas', type: 'apparel', sport: 'training', gender: 'men', price: 4900, category: 'training', colors: ['Black', 'Grey'], sizes: SIZES.apparel, short: 'AEROREADY training tee.', specs: [['Fabric', 'AEROREADY polyester'], ['Fit', 'Regular']] },
  { name: 'Under Armour Tech 2.0 Short Sleeve', brand: 'Under Armour', type: 'apparel', sport: 'training', gender: 'men', price: 5500, category: 'training', colors: ['Black', 'Navy', 'Grey'], sizes: SIZES.apparel, short: 'Quick-drying, ultra-soft training tee.', specs: [['Fabric', 'UA Tech'], ['Fit', 'Loose']] },
  { name: "Puma Train Favourite Women's Tee", brand: 'Puma', type: 'apparel', sport: 'training', gender: 'women', price: 4500, category: 'training', colors: ['Pink', 'Black'], sizes: ['XS', 'S', 'M', 'L'], short: 'Lightweight dryCELL training tee.', specs: [['Fabric', 'dryCELL'], ['Fit', 'Regular']] },
  // Jerseys
  { name: 'Adidas Tiro 24 Competition Jersey', brand: 'Adidas', type: 'jersey', sport: 'football', gender: 'men', price: 8500, category: 'jerseys', colors: ['Black', 'White', 'Royal Blue'], sizes: SIZES.apparel, short: 'Match-day jersey with HEAT.RDY ventilation.', specs: [['Fabric', 'HEAT.RDY'], ['Fit', 'Slim']] },
  { name: 'Nike Strike 24 Jersey', brand: 'Nike', type: 'jersey', sport: 'football', gender: 'men', price: 7900, category: 'jerseys', colors: ['Red', 'Navy'], sizes: SIZES.apparel, short: 'Dri-FIT ADV jersey for high-intensity play.', specs: [['Fabric', 'Dri-FIT ADV'], ['Fit', 'Slim']] },
  { name: 'Puma teamGOAL Matchday Jersey', brand: 'Puma', type: 'jersey', sport: 'football', gender: 'men', price: 6900, category: 'jerseys', colors: ['Green', 'Black'], sizes: SIZES.apparel, short: 'Team jersey ideal for club kits.', specs: [['Fabric', 'dryCELL'], ['Fit', 'Regular']] },
  { name: 'Nike Academy 23 Kids Jersey', brand: 'Nike', type: 'jersey', sport: 'football', gender: 'kids', price: 4900, category: 'jerseys', colors: ['Royal Blue', 'Red'], sizes: SIZES.kidsApparel, short: 'Breathable jersey for young players.', specs: [['Fabric', 'Dri-FIT'], ['Fit', 'Standard']] },
  // Shorts
  { name: 'Nike Flex Stride 7" Running Shorts', brand: 'Nike', type: 'shorts', sport: 'running', gender: 'men', price: 6200, category: 'apparel', colors: ['Black', 'Navy'], sizes: SIZES.apparel, short: 'Brief-lined running shorts with back zip pocket.', specs: [['Inseam', '7"'], ['Liner', 'Brief']] },
  { name: 'Adidas Tiro 24 Training Shorts', brand: 'Adidas', type: 'shorts', sport: 'football', gender: 'men', price: 5200, category: 'apparel', colors: ['Black', 'White'], sizes: SIZES.apparel, short: 'Slim training shorts with zip pockets.', specs: [['Fabric', 'AEROREADY'], ['Pockets', 'Zip side pockets']] },
  { name: "Under Armour Launch 5\" Women's Shorts", brand: 'Under Armour', type: 'shorts', sport: 'running', gender: 'women', price: 5800, category: 'apparel', colors: ['Black', 'Pink'], sizes: ['XS', 'S', 'M', 'L'], short: 'Lightweight running shorts with built-in liner.', specs: [['Inseam', '5"'], ['Liner', 'Built-in']] },
  { name: 'Puma teamGOAL Shorts', brand: 'Puma', type: 'shorts', sport: 'football', gender: 'men', price: 3900, category: 'apparel', colors: ['Black', 'White', 'Navy'], sizes: SIZES.apparel, short: 'Team match shorts.', specs: [['Fabric', 'dryCELL']] },
  // Tracksuits
  { name: 'Adidas Tiro 24 Tracksuit', brand: 'Adidas', type: 'tracksuit', sport: 'training', gender: 'men', price: 17500, category: 'tracksuits', colors: ['Black', 'Navy'], sizes: SIZES.apparel, short: 'Full-zip tracksuit with tapered pants.', specs: [['Fabric', 'Recycled polyester'], ['Fit', 'Slim']] },
  { name: 'Nike Academy 23 Dri-FIT Tracksuit', brand: 'Nike', type: 'tracksuit', sport: 'football', gender: 'men', price: 16900, compareAt: 18900, category: 'tracksuits', colors: ['Black', 'Royal Blue'], sizes: SIZES.apparel, short: 'Knit football tracksuit.', specs: [['Fabric', 'Dri-FIT'], ['Fit', 'Standard']] },
  { name: 'Puma teamRISE Tracksuit', brand: 'Puma', type: 'tracksuit', sport: 'training', gender: 'men', price: 13500, category: 'tracksuits', colors: ['Black', 'Red'], sizes: SIZES.apparel, short: 'Poly tracksuit for warm-ups and travel.', specs: [['Fabric', 'Polyester']] },
  { name: 'Adidas Essentials 3-Stripes Kids Tracksuit', brand: 'Adidas', type: 'tracksuit', sport: 'training', gender: 'kids', price: 9900, category: 'tracksuits', colors: ['Black', 'Navy'], sizes: SIZES.kidsApparel, short: 'Classic 3-Stripes tracksuit for kids.', specs: [['Fabric', 'Recycled polyester']] },
  // Bags
  { name: 'Nike Brasilia 9.5 Duffel (Medium, 60L)', brand: 'Nike', type: 'bag', sport: 'training', gender: 'unisex', price: 8900, category: 'bags', colors: ['Black', 'Grey'], sizes: SIZES.one, short: 'Durable training duffel with shoe compartment.', specs: [['Capacity', '60 L'], ['Dimensions', '61 x 30.5 x 30.5 cm']] },
  { name: 'Adidas Tiro League Backpack', brand: 'Adidas', type: 'bag', sport: 'football', gender: 'unisex', price: 7500, category: 'bags', colors: ['Black', 'Royal Blue'], sizes: SIZES.one, short: 'Backpack with ball net and ventilated pocket.', specs: [['Capacity', '26.5 L']] },
  { name: 'Under Armour Undeniable 5.0 Duffle (M)', brand: 'Under Armour', type: 'bag', sport: 'training', gender: 'unisex', price: 11900, category: 'bags', colors: ['Black', 'Red'], sizes: SIZES.one, short: 'Water-resistant duffle with UA Storm finish.', specs: [['Capacity', '58 L'], ['Finish', 'UA Storm']] },
  // Socks
  { name: 'Nike Everyday Cushioned Crew Socks (3 Pack)', brand: 'Nike', type: 'socks', sport: 'training', gender: 'unisex', price: 3200, category: 'apparel', colors: ['White', 'Black'], sizes: SIZES.socks, short: 'Cushioned crew socks for training.', specs: [['Pack', '3 pairs']] },
  { name: 'Adidas Milano 23 Football Socks', brand: 'Adidas', type: 'socks', sport: 'football', gender: 'unisex', price: 1900, category: 'apparel', colors: ['White', 'Black', 'Red', 'Royal Blue'], sizes: SIZES.socks, short: 'Knee-high football socks.', specs: [['Length', 'Knee-high']] },
  { name: 'Nike Grip Strike Football Socks', brand: 'Nike', type: 'socks', sport: 'football', gender: 'unisex', price: 4500, category: 'apparel', colors: ['White', 'Black'], sizes: SIZES.socks, short: 'Grip socks for in-boot stability.', specs: [['Length', 'Crew'], ['Feature', 'Grip pads']] },
  // Gloves
  { name: 'Adidas Predator Pro Goalkeeper Gloves', brand: 'Adidas', type: 'gloves', sport: 'football', gender: 'unisex', price: 12500, category: 'football', colors: ['Black', 'Volt'], sizes: SIZES.gloves, short: 'Pro-level URG 2.0 latex grip.', specs: [['Palm', 'URG 2.0 latex'], ['Cut', 'Negative']] },
  { name: 'Nike Match Goalkeeper Gloves', brand: 'Nike', type: 'gloves', sport: 'football', gender: 'unisex', price: 5500, category: 'football', colors: ['Black', 'White'], sizes: SIZES.gloves, short: 'Everyday keeper gloves with Grip3 technology.', specs: [['Palm', 'Latex foam']] },
  { name: 'Nike Gym Essential Training Gloves', brand: 'Nike', type: 'gloves', sport: 'training', gender: 'unisex', price: 3900, category: 'training', colors: ['Black'], sizes: ['S', 'M', 'L', 'XL'], short: 'Padded gloves for lifting.', specs: [['Palm', 'Padded synthetic leather']] },
  // Balls
  { name: 'Adidas UCL Pro Match Ball 24/25', brand: 'Adidas', type: 'ball', sport: 'football', gender: 'unisex', price: 26500, category: 'football', colors: ['White'], sizes: ['5'], short: 'FIFA Quality Pro official match ball.', specs: [['Certification', 'FIFA Quality Pro'], ['Construction', 'Thermally bonded']] },
  { name: 'Nike Flight Football', brand: 'Nike', type: 'ball', sport: 'football', gender: 'unisex', price: 23500, category: 'football', colors: ['White', 'Volt'], sizes: SIZES.football, short: 'Aerowsculpt grooves for consistent flight.', specs: [['Certification', 'FIFA Quality Pro']] },
  { name: 'Molten BG5000 Basketball', brand: 'Molten', type: 'ball', sport: 'basketball', gender: 'unisex', price: 18500, category: 'basketball', colors: ['Orange'], sizes: SIZES.basketball, short: 'FIBA-approved premium leather game ball.', specs: [['Certification', 'FIBA approved'], ['Material', 'Genuine leather']] },
  { name: 'Wilson Evolution Indoor Basketball', brand: 'Wilson', type: 'ball', sport: 'basketball', gender: 'unisex', price: 14500, category: 'basketball', colors: ['Orange'], sizes: SIZES.basketball, short: 'Microfiber composite indoor game ball.', specs: [['Use', 'Indoor'], ['Material', 'Microfiber composite']] },
  // Gym equipment
  { name: 'Reebok Hex Dumbbells (Pair)', brand: 'Reebok', type: 'equipment', sport: 'training', gender: 'unisex', price: 9500, category: 'gym-equipment', colors: ['Black'], sizes: SIZES.dumbbell, short: 'Rubber-coated hex dumbbells sold as a pair.', specs: [['Material', 'Rubber-coated cast iron'], ['Handle', 'Chrome knurled']] },
  { name: 'Adidas Performance Yoga Mat 8mm', brand: 'Adidas', type: 'equipment', sport: 'training', gender: 'unisex', price: 6900, category: 'gym-equipment', colors: ['Black', 'Green'], sizes: SIZES.one, short: 'Extra-thick non-slip training mat.', specs: [['Thickness', '8 mm'], ['Size', '176 x 61 cm']] },
  { name: 'Reebok Power Resistance Band Set', brand: 'Reebok', type: 'equipment', sport: 'training', gender: 'unisex', price: 4200, category: 'gym-equipment', colors: ['Black'], sizes: SIZES.one, short: 'Three resistance levels with carry bag.', specs: [['Levels', 'Light / Medium / Heavy']] },
  { name: 'Nike Speed Rope 3.0', brand: 'Nike', type: 'equipment', sport: 'training', gender: 'unisex', price: 2900, category: 'gym-equipment', colors: ['Black', 'Volt'], sizes: SIZES.one, short: 'Adjustable speed rope for conditioning.', specs: [['Length', 'Adjustable up to 3 m']] },
  // Extra lifestyle / drafts
  { name: 'Puma Suede Classic XXI', brand: 'Puma', type: 'footwear', sport: 'lifestyle', gender: 'unisex', price: 12900, category: 'men', colors: ['Black', 'Red'], sizes: SIZES.men, status: 'draft', short: 'The iconic suede silhouette.', specs: [['Upper', 'Suede']] },
  { name: 'Mizuno Wave Rider 27', brand: 'Mizuno', type: 'footwear', sport: 'running', gender: 'men', price: 23500, category: 'running', colors: ['Navy'], sizes: SIZES.men, status: 'archived', short: 'Responsive neutral trainer.', specs: [['Drop', '12 mm']] },
];

const TYPE_CODE: Record<ProductType, string> = {
  footwear: 'FW', apparel: 'AP', jersey: 'JR', shorts: 'SH', tracksuit: 'TS', bag: 'BG', socks: 'SK', gloves: 'GL', ball: 'BL', equipment: 'EQ',
};

const sizeCode = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 5);

function buildVariants(productId: string, baseSku: string, def: Def, lowSet: Set<string>, outSet: Set<string>): ProductVariant[] {
  const out: ProductVariant[] = [];
  def.colors.forEach((colorName) => {
    const color = colorByName(colorName) ?? COLORS[0];
    def.sizes.forEach((size) => {
      const sku = `${baseSku}-${color.code}-${sizeCode(size)}`;
      const threshold = def.type === 'equipment' || def.type === 'ball' ? 4 : 5;
      let stock = rng.int(threshold + 4, def.type === 'socks' ? 90 : 42);
      if (lowSet.has(sku)) stock = rng.int(1, threshold - 1);
      if (outSet.has(sku)) stock = 0;
      out.push({
        id: `var_${sku.toLowerCase()}`,
        productId,
        sku,
        color: color.name,
        colorHex: color.hex,
        size,
        stock,
        reserved: stock > 3 ? rng.int(0, Math.min(4, Math.floor(stock / 5))) : 0,
        lowStockThreshold: threshold,
        barcode: rng.chance(0.7) ? `6${String(rng.int(10 ** 11, 10 ** 12 - 1))}` : undefined,
      });
    });
  });
  return out;
}

// Deliberately flagged variants so the operational widgets have realistic work in them.
const LOW = new Set([
  'SPX-FW-1001-BLK-42', 'SPX-FW-1002-WHT-43', 'SPX-FW-1007-BLK-44', 'SPX-FW-1013-VLT-41',
  'SPX-JR-1022-WHT-M', 'SPX-TS-1030-BLK-L', 'SPX-BL-1043-WHT-5', 'SPX-EQ-1047-BLK-2X10K',
]);
const OUT = new Set(['SPX-FW-1001-VLT-43', 'SPX-FW-1008-WHT-42', 'SPX-AP-1018-RED-XL', 'SPX-BL-1045-ORG-7']);

export const products: Product[] = DEFS.map((def, i) => {
  const n = 1001 + i;
  const id = `prd_${n}`;
  const sku = `SPX-${TYPE_CODE[def.type]}-${n}`;
  const brand = brands.find((b) => b.name === def.brand)!;
  const mainColor = colorByName(def.colors[0])?.hex ?? '#141414';
  const images = [
    { id: `${id}_img1`, url: productArt(def.type, mainColor, { variant: 'main', label: def.brand }), alt: def.name, role: 'main' as const, position: 0 },
    { id: `${id}_img2`, url: productArt(def.type, mainColor, { variant: 'hover', label: def.brand }), alt: `${def.name} alternate view`, role: 'hover' as const, position: 1 },
    ...def.colors.slice(1).map((c, ci) => ({
      id: `${id}_img${ci + 3}`,
      url: productArt(def.type, colorByName(c)?.hex ?? '#141414', { variant: 'main', label: def.brand }),
      alt: `${def.name} in ${c}`,
      role: 'gallery' as const,
      position: ci + 2,
    })),
    { id: `${id}_imgd`, url: productArt(def.type, mainColor, { variant: 'detail', label: def.brand }), alt: `${def.name} detail`, role: 'gallery' as const, position: 10 },
  ];
  const unitsSold = def.status ? rng.int(0, 6) : rng.int(8, 180);
  const created = rng.int(20, 360);
  return {
    id,
    name: def.name,
    slug: slugify(def.name),
    sku,
    brandId: brand.id,
    categoryId: `cat_${def.category}`,
    sport: def.sport,
    gender: def.gender,
    type: def.type,
    status: def.status ?? 'published',
    price: def.price,
    compareAtPrice: def.compareAt,
    costPrice: Math.round((def.price * rng.int(48, 62)) / 100 / 100) * 100,
    taxRate: 10,
    shortDescription: def.short,
    description: `${def.short}\n\nAvailable at SPORTX, Place Menelik, Djibouti. Delivered across Djibouti City with express same-day options.`,
    specs: def.specs.map(([label, value]) => ({ label, value })),
    images,
    variants: buildVariants(id, sku, def, LOW, OUT),
    seo: {
      title: `${def.name} | SPORTX Djibouti`,
      description: def.short,
      keywords: [def.brand.toLowerCase(), def.sport, def.type],
    },
    tags: [def.sport, def.type, def.gender],
    featured: i % 7 === 0,
    unitsSold,
    revenue: unitsSold * def.price,
    views: unitsSold * rng.int(18, 42),
    rating: Math.round((3.6 + rng.next() * 1.4) * 10) / 10,
    reviewCount: rng.int(0, 48),
    publishedAt: def.status ? undefined : daysAgo(created - 1),
    createdAt: daysAgo(created, 9),
    updatedAt: daysAgo(rng.int(0, Math.min(created, 25)), rng.int(8, 18), rng.int(0, 59)),
  };
});

// Derived counts
for (const b of brands) b.productCount = products.filter((p) => p.brandId === b.id).length;
for (const c of categories) {
  const childIds = categories.filter((x) => x.parentId === c.id).map((x) => x.id);
  const genderMatch = c.slug === 'men' || c.slug === 'women' || c.slug === 'kids';
  c.productCount = genderMatch
    ? products.filter((p) => p.gender === c.slug || (p.gender === 'unisex' && c.slug !== 'kids')).length
    : products.filter((p) => p.categoryId === c.id || childIds.includes(p.categoryId)).length;
}

/** Top-level reporting bucket for a product (Football / Basketball / Running / Training / Apparel / Equipment). */
export function reportingCategory(p: Pick<Product, 'categoryId' | 'type' | 'sport'>): string {
  const cat = categories.find((c) => c.id === p.categoryId);
  const root = cat?.parentId ? categories.find((c) => c.id === cat.parentId) : cat;
  const name = root?.name ?? 'Other';
  if (name === 'Men' || name === 'Women' || name === 'Kids') return 'Apparel';
  return name;
}
