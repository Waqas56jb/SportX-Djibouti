import { useEffect, useState } from 'react';
import type { Category } from '@/types';
import { Modal } from '@/components/modals/Overlay';
import { Button } from '@/components/common';
import { Select } from '@/components/forms';
import { categoryOptions } from '@/components/catalog/categoryTree';

export function ChangeCategoryModal({
  open,
  count,
  categories,
  onClose,
  onConfirm,
}: {
  open: boolean;
  count: number;
  categories: Category[];
  onClose: () => void;
  onConfirm: (categoryId: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue('');
      setError(undefined);
    }
  }, [open]);

  const submit = async () => {
    if (!value) return setError('Choose a category.');
    setSaving(true);
    try {
      await onConfirm(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      dismissible={!saving}
      title="Change category"
      description={`Move ${count} selected product${count === 1 ? '' : 's'} to a new category.`}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            Move products
          </Button>
        </>
      }
    >
      <Select
        label="Category"
        required
        placeholder="Select a category…"
        options={categoryOptions(categories)}
        value={value}
        error={error}
        onChange={(e) => {
          setValue(e.target.value);
          setError(undefined);
        }}
        data-autofocus
      />
    </Modal>
  );
}
