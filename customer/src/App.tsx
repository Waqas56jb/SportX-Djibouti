import { RouterProvider } from 'react-router-dom';
import { PageLoader } from '@/components/common';
import { router } from '@/routes';

export default function App() {
  return <RouterProvider router={router} fallbackElement={<PageLoader />} />;
}
