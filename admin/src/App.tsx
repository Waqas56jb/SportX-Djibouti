import { RouterProvider } from 'react-router-dom';
import { router } from '@/routes';
import { Toaster } from '@/components/common/Toaster';
import { ConfirmHost } from '@/components/modals/Overlay';
import { useUiStore } from '@/store/uiStore';

export default function App() {
  // Re-render the tree when the display currency changes so all formatted amounts update.
  const currency = useUiStore((s) => s.currency);
  return (
    <>
      <RouterProvider key={currency} router={router} />
      <Toaster />
      <ConfirmHost />
    </>
  );
}
