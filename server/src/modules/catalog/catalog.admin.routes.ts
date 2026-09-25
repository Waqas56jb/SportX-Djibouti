import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { created, noContent, ok, paginated } from '../../utils/apiResponse.js';
import { badRequest } from '../../utils/errors.js';
import { requirePermission } from '../../middleware/role.middleware.js';
import { validate, query as q, uuidParam } from '../../middleware/validation.middleware.js';
import { imageUpload } from '../../middleware/upload.middleware.js';
import { writeLimiter } from '../../middleware/rateLimit.middleware.js';
import { adminProductsService } from './products.admin.service.js';
import { adminCategoriesService, type CategoryInput } from './categories.service.js';
import { adminBrandsService, type BrandInput } from './brands.service.js';
import {
  activeStatusBody,
  adminProductListQuery,
  brandCreateBody,
  brandListQuery,
  brandUpdateBody,
  bulkBody,
  bulkDeleteBody,
  categoryCreateBody,
  categoryUpdateBody,
  idsBody,
  imagePatchBody,
  imageUploadFields,
  productCreateBody,
  productUpdateBody,
  statusBody,
  validateQuery,
  variantInput,
  variantPatch,
  type AdminProductListQuery,
} from './catalog.admin.schema.js';

const productVariantParams = z.object({ id: z.string().uuid('Invalid id.'), variantId: z.string().uuid('Invalid variantId.') });
const productImageParams = z.object({ id: z.string().uuid('Invalid id.'), imageId: z.string().uuid('Invalid imageId.') });

function requireFile(req: Request): Express.Multer.File {
  if (!req.file) throw badRequest('Attach an image in the "file" field.', { field: 'file' });
  return req.file;
}

// ───────────────────────── /admin/products ─────────────────────────

export const adminProductsRouter = Router();
const P = adminProductsRouter;

P.get(
  '/',
  requirePermission('products:view'),
  validate({ query: adminProductListQuery }),
  asyncHandler(async (req, res) => {
    const out = await adminProductsService.list(q<AdminProductListQuery>(req));
    paginated(res, out.items, out.meta);
  }),
);

P.get(
  '/validate',
  requirePermission('products:view'),
  validate({ query: validateQuery }),
  asyncHandler(async (req, res) => {
    const { field, value, excludeId } = q<z.infer<typeof validateQuery>>(req);
    ok(res, await adminProductsService.isUnique(field, value, excludeId));
  }),
);

P.patch(
  '/bulk',
  requirePermission('products:edit'),
  validate({ body: bulkBody }),
  asyncHandler(async (req, res) => {
    ok(res, await adminProductsService.bulkUpdate(req, req.body), 'Products updated.');
  }),
);

P.post(
  '/bulk-delete',
  requirePermission('products:delete'),
  validate({ body: bulkDeleteBody }),
  asyncHandler(async (req, res) => {
    const out = await adminProductsService.bulkDelete(req, req.body.ids);
    ok(res, out, `${out.deleted.length} deleted, ${out.archived.length} archived (they have order history).`);
  }),
);

P.post(
  '/',
  requirePermission('products:create'),
  writeLimiter,
  validate({ body: productCreateBody }),
  asyncHandler(async (req, res) => {
    created(res, await adminProductsService.create(req, req.body), 'Product created.');
  }),
);

P.get(
  '/:id',
  requirePermission('products:view'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    ok(res, await adminProductsService.get(req.params.id));
  }),
);

for (const method of ['patch', 'put'] as const) {
  P[method](
    '/:id',
    requirePermission('products:edit'),
    validate({ params: uuidParam(), body: productUpdateBody }),
    asyncHandler(async (req, res) => {
      ok(res, await adminProductsService.update(req, req.params.id, req.body), 'Product updated.');
    }),
  );
}

P.patch(
  '/:id/status',
  requirePermission('products:edit'),
  validate({ params: uuidParam(), body: statusBody }),
  asyncHandler(async (req, res) => {
    ok(res, await adminProductsService.setStatus(req, req.params.id, req.body.status), 'Status updated.');
  }),
);

P.delete(
  '/:id',
  requirePermission('products:delete'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    const out = await adminProductsService.remove(req, req.params.id);
    ok(res, out, out.archived ? 'Product has order history, so it was archived instead of deleted.' : 'Product deleted.');
  }),
);

P.post(
  '/:id/duplicate',
  requirePermission('products:create'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    created(res, await adminProductsService.duplicate(req, req.params.id), 'Product duplicated.');
  }),
);

// Variants
P.post(
  '/:id/variants',
  requirePermission('products:edit'),
  validate({ params: uuidParam(), body: variantInput.omit({ id: true }) }),
  asyncHandler(async (req, res) => {
    created(res, await adminProductsService.addVariant(req, req.params.id, req.body), 'Variant created.');
  }),
);

P.patch(
  '/:id/variants/:variantId',
  requirePermission('products:edit'),
  validate({ params: productVariantParams, body: variantPatch }),
  asyncHandler(async (req, res) => {
    ok(res, await adminProductsService.updateVariant(req, req.params.id, req.params.variantId, req.body), 'Variant updated.');
  }),
);

P.delete(
  '/:id/variants/:variantId',
  requirePermission('products:edit'),
  validate({ params: productVariantParams }),
  asyncHandler(async (req, res) => {
    await adminProductsService.deleteVariant(req, req.params.id, req.params.variantId);
    noContent(res, 'Variant removed.');
  }),
);

// Images
P.post(
  '/:id/images',
  requirePermission('products:edit'),
  writeLimiter,
  validate({ params: uuidParam() }),
  imageUpload.single('file'),
  validate({ body: imageUploadFields }),
  asyncHandler(async (req, res) => {
    created(res, await adminProductsService.uploadImage(req, req.params.id, requireFile(req), req.body), 'Image uploaded.');
  }),
);

P.put(
  '/:id/images/order',
  requirePermission('products:edit'),
  validate({ params: uuidParam(), body: idsBody }),
  asyncHandler(async (req, res) => {
    ok(res, await adminProductsService.reorderImages(req, req.params.id, req.body.ids), 'Images reordered.');
  }),
);

P.patch(
  '/:id/images/:imageId',
  requirePermission('products:edit'),
  validate({ params: productImageParams, body: imagePatchBody }),
  asyncHandler(async (req, res) => {
    ok(res, await adminProductsService.updateImage(req, req.params.id, req.params.imageId, req.body), 'Image updated.');
  }),
);

P.delete(
  '/:id/images/:imageId',
  requirePermission('products:edit'),
  validate({ params: productImageParams }),
  asyncHandler(async (req, res) => {
    await adminProductsService.deleteImage(req, req.params.id, req.params.imageId);
    noContent(res, 'Image deleted.');
  }),
);

// ───────────────────────── /admin/categories ─────────────────────────

export const adminCategoriesRouter = Router();
const C = adminCategoriesRouter;

C.get(
  '/',
  requirePermission('categories:view'),
  asyncHandler(async (_req, res) => {
    ok(res, await adminCategoriesService.list());
  }),
);

C.put(
  '/order',
  requirePermission('categories:edit'),
  validate({ body: idsBody }),
  asyncHandler(async (req, res) => {
    await adminCategoriesService.reorder(req, req.body.ids);
    ok(res, await adminCategoriesService.list(), 'Categories reordered.');
  }),
);

C.post(
  '/',
  requirePermission('categories:create'),
  validate({ body: categoryCreateBody }),
  asyncHandler(async (req, res) => {
    created(res, await adminCategoriesService.create(req, req.body as CategoryInput & { name: string }), 'Category created.');
  }),
);

C.get(
  '/:id',
  requirePermission('categories:view'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    ok(res, await adminCategoriesService.get(req.params.id));
  }),
);

for (const method of ['patch', 'put'] as const) {
  C[method](
    '/:id',
    requirePermission('categories:edit'),
    validate({ params: uuidParam(), body: categoryUpdateBody }),
    asyncHandler(async (req, res) => {
      ok(res, await adminCategoriesService.update(req, req.params.id, req.body as CategoryInput), 'Category updated.');
    }),
  );
}

C.patch(
  '/:id/status',
  requirePermission('categories:edit'),
  validate({ params: uuidParam(), body: activeStatusBody }),
  asyncHandler(async (req, res) => {
    ok(res, await adminCategoriesService.setStatus(req, req.params.id, req.body.isActive), 'Status updated.');
  }),
);

C.delete(
  '/:id',
  requirePermission('categories:delete'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    await adminCategoriesService.remove(req, req.params.id);
    noContent(res, 'Category deleted.');
  }),
);

C.post(
  '/:id/image',
  requirePermission('categories:edit'),
  writeLimiter,
  validate({ params: uuidParam() }),
  imageUpload.single('file'),
  asyncHandler(async (req, res) => {
    ok(res, await adminCategoriesService.uploadImage(req, req.params.id, requireFile(req)), 'Image uploaded.');
  }),
);

// ───────────────────────── /admin/brands ─────────────────────────

export const adminBrandsRouter = Router();
const B = adminBrandsRouter;

B.get(
  '/',
  requirePermission('categories:view'),
  validate({ query: brandListQuery }),
  asyncHandler(async (req, res) => {
    ok(res, await adminBrandsService.list(q<z.infer<typeof brandListQuery>>(req).search));
  }),
);

B.post(
  '/',
  requirePermission('categories:create'),
  validate({ body: brandCreateBody }),
  asyncHandler(async (req, res) => {
    created(res, await adminBrandsService.create(req, req.body as BrandInput & { name: string }), 'Brand created.');
  }),
);

B.get(
  '/:id',
  requirePermission('categories:view'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    ok(res, await adminBrandsService.get(req.params.id));
  }),
);

for (const method of ['patch', 'put'] as const) {
  B[method](
    '/:id',
    requirePermission('categories:edit'),
    validate({ params: uuidParam(), body: brandUpdateBody }),
    asyncHandler(async (req, res) => {
      ok(res, await adminBrandsService.update(req, req.params.id, req.body as BrandInput), 'Brand updated.');
    }),
  );
}

B.patch(
  '/:id/status',
  requirePermission('categories:edit'),
  validate({ params: uuidParam(), body: activeStatusBody }),
  asyncHandler(async (req, res) => {
    ok(res, await adminBrandsService.setStatus(req, req.params.id, req.body.isActive), 'Status updated.');
  }),
);

B.delete(
  '/:id',
  requirePermission('categories:delete'),
  validate({ params: uuidParam() }),
  asyncHandler(async (req, res) => {
    await adminBrandsService.remove(req, req.params.id);
    noContent(res, 'Brand deleted.');
  }),
);

B.post(
  '/:id/logo',
  requirePermission('categories:edit'),
  writeLimiter,
  validate({ params: uuidParam() }),
  imageUpload.single('file'),
  asyncHandler(async (req, res) => {
    ok(res, await adminBrandsService.uploadLogo(req, req.params.id, requireFile(req)), 'Logo uploaded.');
  }),
);
