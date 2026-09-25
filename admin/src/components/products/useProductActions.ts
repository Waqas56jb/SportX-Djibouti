import { useNavigate } from 'react-router-dom';
import type { ProductStatus } from '@/types';
import { productService } from '@/services';
import { toast } from '@/store/toastStore';
import { confirm } from '@/store/confirmStore';

const msg = (e: unknown) => (e instanceof Error ? e.message : undefined);

/** Shared product mutations used by the list and detail pages. `onChanged` runs after success. */
export function useProductActions(onChanged?: () => void) {
  const navigate = useNavigate();

  const duplicate = async (id: string) => {
    try {
      const copy = await productService.duplicateProduct(id);
      toast.success('Product duplicated.', { description: 'The copy is saved as a draft with stock reset to 0.' });
      navigate(`/products/${copy.id}/edit`);
    } catch (e) {
      toast.error('Could not duplicate product.', { description: msg(e) });
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
      toast.error('Could not update status.', { description: msg(e) });
      return false;
    }
  };

  const remove = async (id: string, name?: string) => {
    const ok = await confirm({
      title: 'Delete Product?',
      description: (
        name ? `“${name}” and all of its variants will be permanently removed. This action cannot be undone.` : 'This action cannot be undone.'
      ),
      confirmLabel: 'Delete Product',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return false;
    try {
      await productService.deleteProduct(id);
      toast.success('Product deleted.');
      onChanged?.();
      return true;
    } catch (e) {
      toast.error('Could not delete product.', { description: msg(e) });
      return false;
    }
  };

  const removeMany = async (ids: string[]) => {
    const ok = await confirm({
      title: `Delete ${ids.length} products?`,
      description: 'The selected products and their variants will be permanently removed. This action cannot be undone.',
      confirmLabel: 'Delete Products',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return false;
    try {
      await productService.bulkDelete(ids);
      toast.success(`${ids.length} products deleted.`);
      onChanged?.();
      return true;
    } catch (e) {
      toast.error('Could not delete products.', { description: msg(e) });
      return false;
    }
  };

  return { duplicate, setStatus, remove, removeMany };
}
