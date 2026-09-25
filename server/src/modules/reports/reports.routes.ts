import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { ok } from '../../utils/apiResponse.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, query as q } from '../../middleware/validation.middleware.js';
import { reportQuery, type ReportQuery } from './range.js';
import { assertCanExport, sendCsv, toCsv } from './csv.js';
import { customerReport, inventoryReport, inventoryValuation, productReport, productReportQuery, salesReport, type ProductReportQuery } from './reports.service.js';
import { navCounts } from '../dashboard/dashboard.service.js';

/** /api/v1/admin/reports — reports:view; `?format=csv` additionally needs reports:export. */
export const reportsRouter = Router();

const stamp = () => new Date().toISOString().slice(0, 10);

reportsRouter.get(
  '/sales',
  requirePermission('reports:view'),
  validate({ query: reportQuery }),
  asyncHandler(async (req, res) => {
    const f = q<ReportQuery>(req);
    if (f.format === 'csv') assertCanExport(req);
    const report = await salesReport(f);
    if (f.format !== 'csv') return ok(res, report);
    type P = (typeof report.series)[number];
    return sendCsv(
      res,
      `sales-${f.range}-${stamp()}.csv`,
      toCsv<P>(report.series, [
        { header: 'Period start', value: (p) => p.date },
        { header: 'Label', value: (p) => p.label },
        { header: 'Orders', value: (p) => p.orders },
        { header: 'Gross sales', value: (p) => p.grossSales },
        { header: 'Discounts', value: (p) => p.discounts },
        { header: 'Shipping', value: (p) => p.shipping },
        { header: 'Tax', value: (p) => p.tax },
        { header: 'Revenue', value: (p) => p.revenue },
        { header: 'Refunds', value: (p) => p.refunds },
        { header: 'Net sales', value: (p) => p.netSales },
        { header: 'Average order value', value: (p) => p.aov },
      ]),
    );
  }),
);

reportsRouter.get(
  '/products',
  requirePermission('reports:view'),
  validate({ query: productReportQuery }),
  asyncHandler(async (req, res) => {
    const f = q<ProductReportQuery>(req);
    if (f.format === 'csv') assertCanExport(req);
    const report = await productReport(f, { all: f.format === 'csv' });
    if (f.format !== 'csv') return ok(res, report);
    type P = (typeof report.items)[number];
    return sendCsv(
      res,
      `products-${f.range}-${stamp()}.csv`,
      toCsv<P>(report.items, [
        { header: 'Product', value: (p) => p.name },
        { header: 'SKU', value: (p) => p.sku },
        { header: 'Category', value: (p) => p.category },
        { header: 'Brand', value: (p) => p.brand },
        { header: 'Sport', value: (p) => p.sport },
        { header: 'Status', value: (p) => p.status },
        { header: 'Units sold', value: (p) => p.unitsSold },
        { header: 'Revenue', value: (p) => p.revenue },
        { header: 'Views', value: (p) => p.views },
        { header: 'Conversion %', value: (p) => p.conversion },
        { header: 'Stock', value: (p) => p.stock },
      ]),
    );
  }),
);

reportsRouter.get(
  '/customers',
  requirePermission('reports:view'),
  validate({ query: reportQuery }),
  asyncHandler(async (req, res) => {
    const f = q<ReportQuery>(req);
    if (f.format === 'csv') assertCanExport(req);
    const report = await customerReport(f);
    if (f.format !== 'csv') return ok(res, report);
    type P = (typeof report.growth)[number];
    return sendCsv(
      res,
      `customers-${f.range}-${stamp()}.csv`,
      toCsv<P>(report.growth, [
        { header: 'Period start', value: (p) => p.date },
        { header: 'Label', value: (p) => p.label },
        { header: 'New customers', value: (p) => p.newCustomers },
        { header: 'Returning customers', value: (p) => p.returningCustomers },
        { header: 'Buyers', value: (p) => p.buyers },
        { header: 'Total customers', value: (p) => p.total },
      ]),
    );
  }),
);

reportsRouter.get(
  '/inventory',
  requirePermission('reports:view'),
  validate({ query: reportQuery.partial({ range: true }) }),
  asyncHandler(async (req, res) => {
    const f = q<ReportQuery>(req);
    if (f.format === 'csv') {
      assertCanExport(req);
      const rows = await inventoryValuation();
      return sendCsv(
        res,
        `inventory-${stamp()}.csv`,
        toCsv(rows, [
          { header: 'Product', value: (p) => p.name },
          { header: 'SKU', value: (p) => p.sku },
          { header: 'Variants', value: (p) => p.variants },
          { header: 'Units in stock', value: (p) => p.units },
          { header: 'Reserved', value: (p) => p.reserved },
          { header: 'Stock value (cost)', value: (p) => p.value },
          { header: 'Retail value', value: (p) => p.retail_value },
        ]),
      );
    }
    return ok(res, await inventoryReport(f));
  }),
);

/** Sidebar badges (alias of /dashboard/nav-counts for the admin's reportService.getNavCounts). */
reportsRouter.get('/nav-counts', asyncHandler(async (_req, res) => ok(res, await navCounts())));
