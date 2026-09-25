export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface MegaMenu {
  columns: { title: string; links: { label: string; href: string }[] }[];
  feature: { title: string; subtitle: string; image: string; href: string };
}

export interface NavLink {
  /** Stable, language-independent identifier. */
  key?: string;
  label: string;
  href: string;
  highlight?: boolean;
  mega?: MegaMenu;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqGroup {
  id: string;
  title: string;
  items: FaqItem[];
}

export interface ContactPayload {
  name: string;
  email: string;
  phone: string;
  subject?: string;
  message: string;
}

export interface NewsletterResult {
  alreadySubscribed: boolean;
}
