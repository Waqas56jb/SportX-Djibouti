import type { FaqGroup } from '@/types';

/**
 * Customer FAQ. Operational details (timings, fees, windows) mirror the
 * placeholder values in constants/commerce.ts and must be confirmed by the
 * business before launch.
 */
export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'orders',
    title: 'Orders',
    items: [
      {
        question: 'How do I place an order?',
        answer:
          'Choose your product, select a colour and size, then add it to your bag. When you are ready, open your bag and select Proceed to Checkout. You can check out as a guest or sign in to track your order from your account.',
      },
      {
        question: 'Can I change or cancel my order?',
        answer:
          'Orders can be changed or cancelled until they are packed. Contact us as soon as possible from Account → Support or call +253 21 25 26 19 and our team will help.',
      },
      {
        question: 'How do I track my order?',
        answer:
          'Sign in and go to Account → Orders. Each order shows a live timeline from confirmation through to delivery.',
      },
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping & Delivery',
    items: [
      {
        question: 'Where do you deliver?',
        answer:
          'We currently deliver across Djibouti, with Djibouti City as our primary delivery zone. Additional regions will be added over time.',
      },
      {
        question: 'How long does delivery take?',
        answer:
          'Standard delivery typically arrives within 2–4 business days. Express delivery in Djibouti City is dispatched with priority for next-day delivery. Exact timings are shown at checkout.',
      },
      {
        question: 'Can I collect my order in store?',
        answer: 'Yes. Choose Store Pickup at checkout and collect your order from SPORTX, Place Menelik, Rue de Ras Makonnen.',
      },
      {
        question: 'Is delivery free?',
        answer: 'Free delivery applies to selected orders. Your bag shows how close you are to qualifying.',
      },
    ],
  },
  {
    id: 'returns',
    title: 'Returns & Exchanges',
    items: [
      {
        question: 'What is your returns policy?',
        answer:
          'Unworn items in original condition and packaging can be returned or exchanged. See our Returns page for full details and eligibility.',
      },
      {
        question: 'How do I exchange a size?',
        answer:
          'Open a support ticket from your account with your order number and the size you need, or visit us in store with your receipt.',
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments',
    items: [
      {
        question: 'Which payment methods do you accept?',
        answer:
          'Online payment options are shown at checkout. Cash on delivery is available on eligible orders within Djibouti City.',
      },
      {
        question: 'Is my payment information secure?',
        answer:
          'Yes. Card payments are processed by a certified payment partner. SPORTX never stores your full card details.',
      },
      {
        question: 'Which currency are prices shown in?',
        answer: 'All prices are shown in Djiboutian francs (DJF) and include applicable taxes.',
      },
    ],
  },
  {
    id: 'sizing',
    title: 'Sizing',
    items: [
      {
        question: 'How do I find my size?',
        answer:
          'Every product page includes a size guide. For footwear, measure your foot length in centimetres and compare it to the chart. If you are between sizes, we recommend sizing up.',
      },
      {
        question: 'Do your football boots fit true to size?',
        answer:
          'Most SPORTX boots fit true to size. Performance models such as the Pro Elite have a narrower fit — check the Fit line in the product specifications.',
      },
    ],
  },
  {
    id: 'availability',
    title: 'Product Availability',
    items: [
      {
        question: 'An item is out of stock. Will it come back?',
        answer:
          'Many core styles are restocked regularly. Add the item to your wishlist so it is easy to find again, and check back soon.',
      },
      {
        question: 'Do you supply teams, schools and clubs?',
        answer:
          'Yes. We work with sports clubs, schools, gyms and professional teams. Contact us by phone or through the contact form to discuss team orders.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    items: [
      {
        question: 'Do I need an account to order?',
        answer: 'No — guest checkout is available. An account lets you track orders, save addresses, manage your wishlist and contact support faster.',
      },
      {
        question: 'I forgot my password.',
        answer: 'Select Forgot password on the sign-in page and we will send you a link to reset it.',
      },
    ],
  },
  {
    id: 'wishlist',
    title: 'Wishlist',
    items: [
      {
        question: 'How does the wishlist work?',
        answer:
          'Tap the heart on any product to save it. Guests can use the wishlist on this device; sign in to keep your wishlist saved to your account.',
      },
      {
        question: 'Does adding to my wishlist reserve the item?',
        answer: 'No. Wishlisted items are not reserved — add them to your bag and check out to secure your size.',
      },
    ],
  },
];
