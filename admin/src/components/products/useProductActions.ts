import { useNavigate } from 'react-router-dom';
import type { ProductStatus } from '@/types';
import { productService } from '@/services';
import { ApiError } from '@/services/api';
import { errorMessage } from '@/services/errors';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';

/** Error description, including the API's per-product publish blockers when present. */
export function productErrorDescription(e: unknown): string | undefined {
  if (!(e instanceof Error)) return undefined;
  if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') {
    const products = (e.details as { products?: { name: string; missingVariant: boolean; missingMainImage: boolean }[] } | undefined)?.products;
    if (products?.length) {
      const lines = products.slice(0, 4).map((p) => `${p.name}: needs ${[p.missingMainImage && 'a main image', p.missingVariant && 'an active variant'].filter(Boolean).join(' and ')}`);
      return `${e.message} ${lines.join('; ')}${products.length > 4 ? ` (+${products.length - 4} more)` : ''}.`;
    }
  }
  return errorMessage(e);
}

/** Shared product mutations used by the list and detail pages. `onChanged` runs after success. */
export function useProductActions(onChanged?: () => void) {
  const navigate = useNavigate();

  const duplicate = async (id: string) => {
    try {
      const copy = await productService.duplicateProduct(id);
      toast.success('Product duplicated.', { description: 'The copy is saved as a draft with stock reset to 0.' });
      navigate(`/products/${copy.id}/edit`);
    } catch (e) {
      toast.error('Could not duplicate product.', { description: productErrorDescription(e) });
    }
  };

  const setStatus = async (ids: string[], status: ProductStatus) => {
    try {
      await productService.bulkUpdateStatus(ids, status);
      const noun = ids.length === 1 ? 'Product' : `${ids.length} products`;
      const verb = status === 'published' ? 'published' : status === 'archived' ? 'archived' : 'moved to draft';
      toast.success(`${noun} ${verb}.`);
      onChanged?.();
      return true;
    } catch (e) {
      toast.error(status === 'published' ? 'Could not publish.' : 'Could not update status.', { description: productErrorDescription(e) });
      return false;
    }
  };

  const remove = async (id: string, name?: string) => {
    const ok = await confirm({
      title: 'Delete Product?',
      description: name
        ? `“${name}” and its variants will be removed. Products with order history are archived instead so past orders stay intact.`
        : 'This action cannot be undone.',
      confirmLabel: 'Delete Product',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return false;
    try {
      const { result } = await productService.deleteProduct(id);
      if (result === 'ARCHIVED') toast.info('Product archived instead of deleted.', { description: 'It has order history, so it was archived and hidden from the store.' });
      else toast.success('Product deleted.');
      onChanged?.();
      return true;
    } catch (e) {
      toast.error('Could not delete product.', { description: productErrorDescription(e) });
      return false;
    }
  };

  const removeMany = async (ids: string[]) => {
    const ok = await confirm({
      title: `Delete ${ids.length} products?`,
      description: 'The selected products and their variants will be removed. Products with order history are archived instead.',
      confirmLabel: 'Delete Products',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return false;
    try {
      const { deleted, archived } = await productService.bulkDelete(ids);
      const parts = [deleted.length && `${deleted.length} deleted`, archived.length && `${archived.length} archived (order history)`].filter(Boolean);
      toast.success(`Products removed: ${parts.join(', ')}.`);
      onChanged?.();
      return true;
    } catch (e) {
      toast.error('Could not delete products.', { description: productErrorDescription(e) });
      return false;
    }
  };

  return { duplicate, setStatus, remove, removeMany };
}
