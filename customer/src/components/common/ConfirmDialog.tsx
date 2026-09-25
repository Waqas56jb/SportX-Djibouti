import { AlertTriangle } from 'lucide-react';
import { t } from '@/i18n';
import { Button } from './Button';
import { Modal } from './Overlay';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="flex gap-4 px-5 py-6 sm:px-6">
        {destructive && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
        )}
        <p className="text-sm leading-relaxed text-ink-600">{description}</p>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-paper-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel ?? t('common.actions.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          loading={loading}
          className={destructive ? 'bg-danger hover:bg-danger/90' : undefined}
          data-autofocus
        >
          {confirmLabel ?? t('common.actions.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
