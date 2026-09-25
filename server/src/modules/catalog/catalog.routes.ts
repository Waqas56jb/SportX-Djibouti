import { Router } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { ok, paginated } from '../../utils/apiResponse.js';
import { badRequest } from '../../utils/errors.js';
import { validate, query as q } from '../../middleware/validation.middleware.js';
import { productReviewsRouter } from '../reviews/reviews.routes.js';
import { publicProductsService } from './products.public.service.js';
import { publicCategoriesService } from './categories.service.js';
import { publicBrandsService } from './brands.service.js';
import { batchQuery, featuredQuery, idOrSlugParam, limitQuery, productListQuery, slugParam, type ProductListFilters } from './catalog.schema.js';

/** Short public cache for anonymous catalogue reads (prices can change with promotions → keep it brief). */
const cache = (seconds: number) => (res: import('express').Response) => res.setHeader('Cache-Control', `public, max-age=${seconds}`);

// ───────────────────────── /products ─────────────────────────

export const productsRouter = Router();

productsRouter.get(
  '/',
  validate({ query: productListQuery }),
  asyncHandler(async (req, res) => {
    const out = await publicProductsService.list(q<ProductListFilters>(req));
    cache(30)(res);
    paginated(res, out.items, out.meta, { facets: out.facets });
  }),
);

productsRouter.get(
  '/search',
  validate({ query: productListQuery }),
  asyncHandler(async (req, res) => {
    const f = q<ProductListFilters>(req);
    if (!f.q) throw badRequest('Enter a search term.', { field: 'q' });
    const out = await publicProductsService.list(f);
    paginated(res, out.items, out.meta, { facets: out.facets, query: f.q });
  }),
);

productsRouter.get(
  '/featured',
  validate({ query: featuredQuery }),
  asyncHandler(async (req, res) => {
    const { kind, limit } = q<z.infer<typeof featuredQuery>>(req);
    cache(60)(res);
    ok(res, await publicProductsService.featured(kind, limit));
  }),
);

productsRouter.get(
  '/batch',
  validate({ query: batchQuery }),
  asyncHandler(async (req, res) => {
    const { ids = [], slugs = [] } = q<z.infer<typeof batchQuery>>(req);
    ok(res, ids.length || slugs.length ? await publicProductsService.batch(ids, slugs) : []);
  }),
);

// Product reviews (owned by the reviews module): GET / POST /products/:id/reviews — :id is a UUID or slug.
productsRouter.use('/:id/reviews', productReviewsRouter);

productsRouter.get(
  '/:idOrSlug/related',
  validate({ params: idOrSlugParam, query: limitQuery(8) }),
  asyncHandler(async (req, res) => {
    ok(res, await publicProductsService.related(req.params.idOrSlug, q<{ limit: number }>(req).limit));
  }),
);

productsRouter.get(
  '/:idOrSlug/complete-the-look',
  validate({ params: idOrSlugParam, query: limitQuery(4) }),
  asyncHandler(async (req, res) => {
    ok(res, await publicProductsService.completeTheLook(req.params.idOrSlug, q<{ limit: number }>(req).limit));
  }),
);

productsRouter.get(
  '/:idOrSlug',
  validate({ params: idOrSlugParam }),
  asyncHandler(async (req, res) => {
    ok(res, await publicProductsService.detail(req.params.idOrSlug));
  }),
);

// ───────────────────────── /categories, /brands ─────────────────────────

export const categoriesRouter = Router();

categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    cache(120)(res);
    ok(res, await publicCategoriesService.tree());
  }),
);

categoriesRouter.get(
  '/:slug',
  validate({ params: slugParam }),
  asyncHandler(async (req, res) => {
    ok(res, await publicCategoriesService.bySlug(req.params.slug));
  }),
);

export const brandsRouter = Router();

brandsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    cache(120)(res);
    ok(res, await publicBrandsService.list());
  }),
);

brandsRouter.get(
  '/:slug',
  validate({ params: slugParam }),
  asyncHandler(async (req, res) => {
    ok(res, await publicBrandsService.bySlug(req.params.slug));
  }),
);
