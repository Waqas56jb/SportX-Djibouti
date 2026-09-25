import { pool, query, queryOne, type Db } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { internalShippingProvider, type ShippingMethodRecord, type ShippingProvider } from '../../services/shipping/shipping.provider.js';
import { getStoreSettings } from '../settings/settings.service.js';

const provider: ShippingProvider = internalShippingProvider;

interface Row {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  free_shipping_threshold: number | null;
  min_days: number;
  max_days: number;
  requires_address: boolean;
  carrier: string | null;
  regions: string[];
}

const map = (r: Row): ShippingMethodRecord => ({
  id: r.id,
  code: r.code,
  name: r.name,
  description: r.description,
  price: r.price,
  freeShippingThreshold: r.free_shipping_threshold,
  minDays: r.min_days,
  maxDays: r.max_days,
  requiresAddress: r.requires_address,
  carrier: r.carrier,
  regions: r.regions ?? [],
});

const SELECT = `select m.id, m.code, m.name, m.description, m.price, m.free_shipping_threshold, m.min_days, m.max_days,
  m.requires_address, m.carrier, z.regions
  from public.shipping_methods m join public.shipping_zones z on z.id = m.zone_id`;

export const shippingService = {
  provider,

  async listActiveMethods(db: Db = pool): Promise<ShippingMethodRecord[]> {
    const rows = await query<Row>(`${SELECT} where m.is_active and z.is_active order by z.sort_order, m.sort_order`, [], db);
    return rows.map(map);
  },

  /** Looks up an active method by code or id; throws ORDER_INVALID if unavailable. */
  async requireMethod(codeOrId: string, db: Db = pool): Promise<ShippingMethodRecord> {
    const row = await queryOne<Row>(`${SELECT} where m.is_active and z.is_active and (m.code = $1 or m.id::text = $1)`, [codeOrId], db);
    if (!row) throw new AppError('ORDER_INVALID', 'This shipping method is not available.', { shippingMethod: codeOrId });
    return map(row);
  },

  /** Quotes every active method for a merchandise total (checkout shipping step). */
  async quoteAll(merchandiseTotal: number, city?: string, db: Db = pool) {
    const [methods, settings] = await Promise.all([this.listActiveMethods(db), getStoreSettings(db)]);
    return methods
      .filter((m) => !city || m.regions.length === 0 || m.regions.some((r) => r.toLowerCase() === city.toLowerCase()) || !m.requiresAddress)
      .map((m) => ({ ...provider.quote({ method: m, merchandiseTotal, storeFreeShippingThreshold: settings.freeShippingThreshold, city }), description: m.description, requiresAddress: m.requiresAddress, carrier: m.carrier }));
  },
};
