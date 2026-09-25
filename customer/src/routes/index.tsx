import { lazy } from 'react';
import { createBrowserRouter, isRouteErrorResponse, useRouteError, type RouteObject } from 'react-router-dom';
import { AccountLayout } from '@/components/account/AccountLayout';
import { ErrorState } from '@/components/common';
import { CheckoutLayout, GuestOnly, MainLayout, RequireAuth } from '@/components/layout/Layouts';
import { COLLECTIONS } from '@/data/collections';

// Route-level code splitting: each page ships as its own chunk.
const HomePage = lazy(() => import('@/pages/Home'));
const ShopPage = lazy(() => import('@/pages/Shop'));
const CategoriesIndexPage = lazy(() => import('@/pages/Categories').then((m) => ({ default: m.CategoriesIndexPage })));
const CategoryPage = lazy(() => import('@/pages/Categories').then((m) => ({ default: m.CategoryPage })));
const SearchPage = lazy(() => import('@/pages/Search'));
const ProductPage = lazy(() => import('@/pages/Product'));
const CartPage = lazy(() => import('@/pages/Cart'));
const CheckoutPage = lazy(() => import('@/pages/Checkout'));
const OrderConfirmationPage = lazy(() => import('@/pages/Orders/OrderConfirmation'));
const WishlistPage = lazy(() => import('@/pages/Wishlist'));
const AccountWishlistPage = lazy(() => import('@/pages/Wishlist').then((m) => ({ default: m.AccountWishlistPage })));
const LoginPage = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.ResetPasswordPage })));
const AccountOverviewPage = lazy(() => import('@/pages/Account/Overview'));
const OrdersPage = lazy(() => import('@/pages/Orders').then((m) => ({ default: m.OrdersPage })));
const OrderDetailsPage = lazy(() => import('@/pages/Orders').then((m) => ({ default: m.OrderDetailsPage })));
const AddressesPage = lazy(() => import('@/pages/Account/Addresses'));
const AccountReviewsPage = lazy(() => import('@/pages/Account/Reviews'));
const PaymentHistoryPage = lazy(() => import('@/pages/Account/Payments'));
const SupportPage = lazy(() => import('@/pages/Account/Support').then((m) => ({ default: m.SupportPage })));
const TicketDetailPage = lazy(() => import('@/pages/Account/Support').then((m) => ({ default: m.TicketDetailPage })));
const SettingsPage = lazy(() => import('@/pages/Account/Settings'));
const AboutPage = lazy(() => import('@/pages/About'));
const ContactPage = lazy(() => import('@/pages/Contact'));
const FaqPage = lazy(() => import('@/pages/FAQ'));
const LegalPage = lazy(() => import('@/pages/Legal'));
const NotFoundPage = lazy(() => import('@/pages/NotFound'));

function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} — ${error.statusText}` : error instanceof Error ? error.message : undefined;
  return (
    <div className="container-site">
      <ErrorState
        title="Something went wrong"
        message={import.meta.env.DEV ? message : 'An unexpected error occurred. Please refresh the page or try again shortly.'}
        onRetry={() => window.location.reload()}
        className="min-h-[60vh] justify-center"
      />
    </div>
  );
}

/** /shop, /men, /women, /kids, /football, /basketball, /running, /training, /equipment, /new-arrivals, /sale */
const collectionRoutes: RouteObject[] = COLLECTIONS.map((c) => ({
  path: c.path,
  element: <ShopPage key={c.key} collectionKey={c.key} />,
}));

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      ...collectionRoutes,
      { path: '/categories', element: <CategoriesIndexPage /> },
      { path: '/categories/:slug', element: <CategoryPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/product/:slug', element: <ProductPage /> },
      { path: '/cart', element: <CartPage /> },
      { path: '/wishlist', element: <WishlistPage /> },
      { path: '/order-confirmation/:orderId', element: <OrderConfirmationPage /> },
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/account',
            element: <AccountLayout />,
            children: [
              { index: true, element: <AccountOverviewPage /> },
              { path: 'orders', element: <OrdersPage /> },
              { path: 'orders/:id', element: <OrderDetailsPage /> },
              { path: 'wishlist', element: <AccountWishlistPage /> },
              { path: 'addresses', element: <AddressesPage /> },
              { path: 'reviews', element: <AccountReviewsPage /> },
              { path: 'payments', element: <PaymentHistoryPage /> },
              { path: 'support', element: <SupportPage /> },
              { path: 'support/:id', element: <TicketDetailPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
      { path: '/about', element: <AboutPage /> },
      { path: '/contact', element: <ContactPage /> },
      { path: '/faq', element: <FaqPage /> },
      { path: '/privacy', element: <LegalPage doc="privacy" /> },
      { path: '/terms', element: <LegalPage doc="terms" /> },
      { path: '/shipping', element: <LegalPage doc="shipping" /> },
      { path: '/returns', element: <LegalPage doc="returns" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <CheckoutLayout />,
    errorElement: <RouteError />,
    children: [{ path: '/checkout', element: <CheckoutPage /> }],
  },
]);
