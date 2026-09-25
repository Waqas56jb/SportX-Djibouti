import type { Gender, ProductType, Sport, StockReason, RefundReason, CampaignType, TicketCategory } from '@/types';

export const SPORTS: { value: Sport; label: string }[] = [
  { value: 'football', label: 'Football' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'running', label: 'Running' },
  { value: 'training', label: 'Training' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'multi-sport', label: 'Multi-sport' },
];

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'kids', label: 'Kids' },
  { value: 'unisex', label: 'Unisex' },
];

export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'footwear', label: 'Footwear' },
  { value: 'apparel', label: 'Apparel' },
  { value: 'jersey', label: 'Jersey' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'tracksuit', label: 'Tracksuit' },
  { value: 'bag', label: 'Bag' },
  { value: 'socks', label: 'Socks' },
  { value: 'gloves', label: 'Gloves' },
  { value: 'ball', label: 'Ball' },
  { value: 'equipment', label: 'Equipment' },
];

export interface ColorOption {
  name: string;
  hex: string;
  code: string;
}

export const COLORS: ColorOption[] = [
  { name: 'Black', hex: '#141414', code: 'BLK' },
  { name: 'White', hex: '#F2F2F0', code: 'WHT' },
  { name: 'Red', hex: '#C8252C', code: 'RED' },
  { name: 'Navy', hex: '#1D2B53', code: 'NVY' },
  { name: 'Royal Blue', hex: '#2250C4', code: 'RBL' },
  { name: 'Grey', hex: '#8A8F98', code: 'GRY' },
  { name: 'Volt', hex: '#C8F54A', code: 'VLT' },
  { name: 'Orange', hex: '#EE6A1F', code: 'ORG' },
  { name: 'Green', hex: '#1F7A45', code: 'GRN' },
  { name: 'Pink', hex: '#E0628F', code: 'PNK' },
  { name: 'Gold', hex: '#C9982C', code: 'GLD' },
  { name: 'Purple', hex: '#5E3A99', code: 'PRP' },
];

export const colorByName = (name: string) => COLORS.find((c) => c.name === name);

export const SIZE_PRESETS: { id: string; label: string; sizes: string[] }[] = [
  { id: 'eu-men', label: 'Footwear EU (Men)', sizes: ['39', '40', '41', '42', '43', '44', '45'] },
  { id: 'eu-women', label: 'Footwear EU (Women)', sizes: ['36', '37', '38', '39', '40', '41'] },
  { id: 'eu-kids', label: 'Footwear EU (Kids)', sizes: ['30', '32', '34', '36'] },
  { id: 'apparel', label: 'Apparel', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { id: 'kids-apparel', label: 'Kids apparel', sizes: ['6-8Y', '8-10Y', '10-12Y', '12-14Y'] },
  { id: 'socks', label: 'Socks', sizes: ['S (34-38)', 'M (38-42)', 'L (42-46)'] },
  { id: 'gloves', label: 'Gloves', sizes: ['7', '8', '9', '10', '11'] },
  { id: 'ball-football', label: 'Football size', sizes: ['4', '5'] },
  { id: 'ball-basketball', label: 'Basketball size', sizes: ['6', '7'] },
  { id: 'one-size', label: 'One size', sizes: ['One Size'] },
];

export const STOCK_REASONS: { value: StockReason; label: string }[] = [
  { value: 'restock', label: 'Restock' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'returned', label: 'Returned' },
  { value: 'manual_correction', label: 'Manual correction' },
  { value: 'sale_adjustment', label: 'Sale adjustment' },
  { value: 'other', label: 'Other' },
];

export const REFUND_REASONS: { value: RefundReason; label: string }[] = [
  { value: 'customer_request', label: 'Customer request' },
  { value: 'damaged_item', label: 'Damaged item' },
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'payment_issue', label: 'Payment issue' },
  { value: 'other', label: 'Other' },
];

export const CAMPAIGN_TYPES: { value: CampaignType; label: string }[] = [
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'new_arrivals', label: 'New arrivals' },
  { value: 'football', label: 'Football' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'training', label: 'Training' },
  { value: 'clearance', label: 'Clearance' },
  { value: 'limited_release', label: 'Limited release' },
];

export const TICKET_CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'order', label: 'Order' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'return', label: 'Return / exchange' },
  { value: 'product', label: 'Product question' },
  { value: 'payment', label: 'Payment' },
  { value: 'account', label: 'Account' },
  { value: 'other', label: 'Other' },
];

export const labelOf = <T extends string>(list: { value: T; label: string }[], v: T | undefined) =>
  list.find((o) => o.value === v)?.label ?? (v ? String(v) : '—');
