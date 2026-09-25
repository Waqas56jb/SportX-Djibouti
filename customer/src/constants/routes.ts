export const ROUTES = {
  home: '/',
  shop: '/shop',
  newArrivals: '/new-arrivals',
  sale: '/sale',
  search: '/search',
  categories: '/categories',
  cart: '/cart',
  checkout: '/checkout',
  wishlist: '/wishlist',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  account: '/account',
  accountOrders: '/account/orders',
  accountWishlist: '/account/wishlist',
  accountAddresses: '/account/addresses',
  accountReviews: '/account/reviews',
  accountPayments: '/account/payments',
  accountSupport: '/account/support',
  accountSettings: '/account/settings',
  about: '/about',
  contact: '/contact',
  faq: '/faq',
  privacy: '/privacy',
  terms: '/terms',
  shipping: '/shipping',
  returns: '/returns',
} as const;

export const productPath = (slug: string) => `/product/${slug}`;
export const categoryPath = (slug: string) => `/categories/${slug}`;
export const orderPath = (id: string) => `/account/orders/${id}`;
export const ticketPath = (id: string) => `/account/support/${id}`;
export const confirmationPath = (orderId: string) => `/order-confirmation/${orderId}`;
export const searchPath = (q: string) => `/search?q=${encodeURIComponent(q)}`;
