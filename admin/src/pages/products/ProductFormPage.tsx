import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Product, ProductImage, ProductStatus, ProductVariant } from '@/types';
import { brandService, categoryService, productService } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader, StatusBadge } from '@/components/common';
import { PRODUCT_STATUS } from '@/constants/status';
import { toast } from '@/store/toastStore';
import { emptyDraft, fromProduct, sectionCompletion, sectionOfError, toInput, validate, type FormErrors, type ProductDraft, type SectionId, type SetDraft } from '@/components/products/form/model';
import { SectionNav } from '@/components/products/form/SectionNav';
import { ErrorSummary, SaveBar, type SaveIntent } from '@/components/products/form/SaveBar';
import { BasicInfoSection } from '@/components/products/form/BasicInfoSection';
import { MediaSection } from '@/components/products/form/MediaSection';
import { PricingSection } from '@/components/products/form/PricingSection';
import { VariantsSection } from '@/components/products/form/VariantsSection';
import { InventorySection } from '@/components/products/form/InventorySection';
import { DescriptionSection, SeoSection, SpecsSection } from '@/components/products/form/ContentSections';
import { PublishingSection } from '@/components/products/form/PublishingSection';
import { useUnsavedGuard } from '@/components/products/form/useUnsavedGuard';
import { ProductFormSkeleton, ProductLoadError } from '@/components/products/ProductStates';

export default function ProductFormPage() {
  const { id } = useParams();
  const mode = id ? 'edit' : 'create';
  const navigate = useNavigate();

  const product = useAsync<Product | null>(() => (id ? productService.getProduct(id) : Promise.resolve(null)), [id]);
  const { data: categories } = useAsync(() => categoryService.getCategories(), []);
  const { data: brands } = useAsync(() => brandService.getBrands(), []);

  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [baseline, setBaseline] = useState(() => JSON.stringify(emptyDraft()));
  const [slugLocked, setSlugLocked] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uniqueErrors, setUniqueErrors] = useState<{ slug?: string; sku?: string }>({});
  const [checking, setChecking] = useState({ slug: false, sku: false });
  const [saving, setSaving] = useState<SaveIntent | null>(null);
  /** Status targeted by the last save attempt — publish-only rules apply when it was 'published'. */
  const [attemptStatus, setAttemptStatus] = useState<ProductStatus>('draft');
  const summaryRef = useRef<HTMLDivElement>(null);

  // Hydrate once the product arrives (edit mode).
  useEffect(() => {
    if (!product.data) return;
    const d = fromProduct(product.data);
    setDraft(d);
    setBaseline(JSON.stringify(d));
    setSlugLocked(true);
  }, [product.data]);

  const dirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);
  const { bypass } = useUnsavedGuard(dirty && !saving);

  const set: SetDraft = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key === 'slug' || key === 'sku') setUniqueErrors((u) => ({ ...u, [key]: undefined }));
  };
  const updateImages = (fn: (prev: ProductImage[]) => ProductImage[]) => setDraft((d) => ({ ...d, images: fn(d.images) }));
  const updateVariants = (fn: (prev: ProductVariant[]) => ProductVariant[]) => setDraft((d) => ({ ...d, variants: fn(d.variants) }));

  const intentStatus = (intent: SaveIntent): ProductStatus => (intent === 'draft' ? 'draft' : intent === 'publish' ? 'published' : draft.status);
  const errors: FormErrors = useMemo(() => {
    const base = submitted ? validate(draft, attemptStatus) : {};
    const out: FormErrors = { ...base };
    if (uniqueErrors.slug && !out.slug) out.slug = uniqueErrors.slug;
    if (uniqueErrors.sku && !out.sku) out.sku = uniqueErrors.sku;
    return out;
  }, [draft, submitted, uniqueErrors, attemptStatus]);
  const errorSections = useMemo(() => new Set<SectionId>(Object.keys(errors).map(sectionOfError)), [errors]);
  const completion = sectionCompletion(draft);

  const checkUnique = async (field: 'slug' | 'sku', value = draft[field]): Promise<boolean> => {
    if (!value.trim()) return true;
    setChecking((c) => ({ ...c, [field]: true }));
    try {
      const ok = await productService.isUnique(field, value, id);
      setUniqueErrors((u) => ({ ...u, [field]: ok ? undefined : field === 'slug' ? 'This slug is already used by another product.' : 'This SKU is already used by another product.' }));
      return ok;
    } catch {
      return true; // Server will re-validate on save.
    } finally {
      setChecking((c) => ({ ...c, [field]: false }));
    }
  };

  const focusFirstError = (errs: FormErrors) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    summaryRef.current?.focus({ preventScroll: true });
    const section = document.getElementById(sectionOfError(first));
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => section?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus({ preventScroll: true }), 450);
  };

  const save = async (intent: SaveIntent) => {
    setSubmitted(true);
    const status = intentStatus(intent);
    setAttemptStatus(status);
    const errs = validate(draft, status);
    setSaving(intent);
    const [slugOk, skuOk] = await Promise.all([checkUnique('slug'), checkUnique('sku')]);
    if (!slugOk) errs.slug = 'This slug is already used by another product.';
    if (!skuOk) errs.sku = 'This SKU is already used by another product.';
    if (Object.keys(errs).length) {
      setSaving(null);
      toast.error('Please review the highlighted fields.', { description: `${Object.keys(errs).length} issue(s) must be fixed before saving.` });
      requestAnimationFrame(() => focusFirstError(errs));
      return;
    }
    try {
      const input = toInput({ ...draft, status }, status);
      const saved = id ? await productService.updateProduct(id, input) : await productService.createProduct(input);
      toast.success(id ? 'Product updated.' : 'Product created successfully.');
      bypass();
      navigate(`/products/${saved.id}`);
    } catch (e) {
      toast.error('Could not save product.', { description: e instanceof Error ? e.message : undefined });
      setSaving(null);
    }
  };

  if (id && product.loading) return <ProductFormSkeleton />;
  if (id && (product.error || !product.data)) return <ProductLoadError error={product.error ?? new Error('Not found')} onRetry={() => void product.reload()} />;

  const brandName = brands?.find((b) => b.id === draft.brandId)?.name;
  const errorCount = Object.keys(errors).length;

  return (
    <>
      <PageHeader
        backTo={id ? `/products/${id}` : '/products'}
        backLabel={id ? 'Back to product' : 'Products'}
        eyebrow={mode === 'edit' ? 'Edit product' : 'Catalogue'}
        title={mode === 'edit' ? draft.name || 'Untitled product' : 'Add product'}
        documentTitle={mode === 'edit' ? `Edit ${product.data?.name ?? 'product'}` : 'Add product'}
        description={mode === 'edit' ? undefined : 'Complete each section — you can save a draft at any time and publish when ready.'}
        meta={
          mode === 'edit' ? (
            <>
              <StatusBadge map={PRODUCT_STATUS} value={draft.status} size="md" />
              <span className="font-mono text-xs text-zinc-500">{draft.sku}</span>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:gap-8">
        <SectionNav completion={completion} errorSections={errorSections} />
        <form
          noValidate
          aria-label={mode === 'edit' ? 'Edit product' : 'Create product'}
          className="min-w-0 space-y-6"
          onSubmit={(e) => e.preventDefault()}
        >
          {submitted && <ErrorSummary ref={summaryRef} errors={errors} />}
          <BasicInfoSection
            draft={draft}
            set={set}
            errors={errors}
            brands={brands ?? []}
            categories={categories ?? []}
            slugLocked={slugLocked}
            onSlugLockedChange={setSlugLocked}
            checking={checking}
            onCheckUnique={(f) => void checkUnique(f)}
          />
          <MediaSection images={draft.images} update={updateImages} error={errors.images} productName={draft.name} />
          <PricingSection draft={draft} set={set} errors={errors} />
          <VariantsSection draft={draft} productId={id ?? ''} errors={errors} update={updateVariants} />
          <InventorySection variants={draft.variants} update={updateVariants} />
          <DescriptionSection draft={draft} set={set} errors={errors} />
          <SpecsSection specs={draft.specs} onChange={(s) => set('specs', s)} error={errors.specs} />
          <SeoSection draft={draft} set={set} brandName={brandName} />
          <PublishingSection draft={draft} set={set} />
        </form>
      </div>

      <SaveBar
        mode={mode}
        dirty={dirty}
        saving={saving}
        errorCount={errorCount}
        isPublished={draft.status === 'published'}
        onCancel={() => navigate(id ? `/products/${id}` : '/products')}
        onSave={(intent) => void save(intent)}
      />
    </>
  );
}
