import type { en } from '../en';
import type { LocaleShape } from '../types';
import { common } from './common';
import { layout } from './layout';
import { home } from './home';
import { collections } from './collections';
import { catalog } from './catalog';
import { product } from './product';
import { cart } from './cart';
import { checkout } from './checkout';
import { orders } from './orders';
import { account } from './account';
import { auth } from './auth';
import { pages } from './pages';

export const ar: LocaleShape<typeof en> = { common, layout, home, collections, catalog, product, cart, checkout, orders, account, auth, pages };
