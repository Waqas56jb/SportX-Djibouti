import { RouterProvider } from 'react-router-dom';
import { PageLoader } from '@/components/common';
import { useLangStore } from '@/i18n';
import { router } from '@/routes';

export default function App() {
  // Remount the routed tree when the language changes so every string, price and date re-renders.
  const lang = useLangStore((s) => s.lang);
  return <RouterProvider key={lang} router={router} fallbackElement={<PageLoader />} />;
}
