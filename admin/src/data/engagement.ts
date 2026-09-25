import type { AdminNotification, Review, SupportTicket, TicketMessage, TicketPriority, TicketStatus, TicketCategory } from '@/types';
import { customers } from './people';
import { products } from './catalog';
import { orders } from './orders';
import { addMinutes, createRng, daysAgo } from './seed';

const rng = createRng(777);

// ─── Reviews ────────────────────────────────────────────────────────────────
const REVIEW_TEXT: [Review['rating'], string, string][] = [
  [5, 'Fast and light', 'Wore them for two five-a-side sessions at Stade du Ville. Very light and the lockdown is excellent. True to size.'],
  [5, 'Perfect for the heat', 'Fabric dries quickly even in Djibouti summer. Washed it five times, no fading.'],
  [4, 'Great shoe, runs a bit narrow', 'Cushioning is excellent for my evening runs along the corniche. Would order half a size up next time.'],
  [5, 'Delivered the same day', 'Ordered in the morning, arrived in the afternoon in Haramous. Product exactly as described.'],
  [3, 'Good but pricey', 'Quality is good but I expected a better price for this model.'],
  [2, 'Sizing issue', 'Size chart says 42 fits me but the boot is too tight around the toes. Waiting for an exchange.'],
  [5, 'Match quality ball', 'Used it for our Friday league. Holds its shape and flight is very consistent.'],
  [4, 'Solid grip', 'Grip is great on the indoor court. Takes a couple of sessions to break in.'],
  [1, 'Stitching came apart', 'After one week the stitching on the side started to come apart. Very disappointed.'],
  [5, 'My son loves it', 'Bought for my son’s football academy. Comfortable and looks great.'],
  [4, 'Good value', 'Comfortable tracksuit, good for early morning training. Pants are a little long.'],
  [5, 'Excellent bag', 'Plenty of space for boots and kit. Separate shoe compartment is very useful.'],
  [3, 'Average', 'Does the job for the gym. Nothing special.'],
  [5, 'Best running shoe I’ve owned', 'Stable and comfortable for 10k runs. Worth every franc.'],
  [4, 'Nice fit', 'Slim fit jersey, breathable. Colour is slightly darker than the photo.'],
  [2, 'Late delivery', 'Product is fine but delivery to Tadjourah took longer than promised.'],
  [5, 'Great gloves', 'Grip is incredible in dry conditions. Recommended for keepers.'],
  [4, 'Comfortable socks', 'Good cushioning, stay up during the full match.'],
  [5, 'Quality dumbbells', 'Solid and no smell of rubber. Good for home workouts.'],
  [1, 'Wrong colour received', 'I ordered black and received white. Support is handling it.'],
  [4, 'Light and responsive', 'Very comfortable for basketball. Would like more ankle support.'],
  [5, 'Fantastic service', 'Store team helped me choose the right size by phone. Product is perfect.'],
];

const STATUSES: Review['status'][] = ['pending', 'pending', 'approved', 'pending', 'approved', 'pending', 'approved', 'approved', 'rejected', 'approved', 'approved', 'approved', 'hidden', 'approved', 'pending', 'approved', 'approved', 'approved', 'approved', 'pending', 'approved', 'approved'];

const published = products.filter((p) => p.status === 'published');

export const reviews: Review[] = REVIEW_TEXT.map(([rating, title, body], i) => {
  const product = published[(i * 7 + 3) % published.length];
  const customer = customers[(i * 5 + 2) % customers.length];
  const status = STATUSES[i];
  const created = daysAgo(Math.floor(i * 1.6), rng.int(8, 22), rng.int(0, 59));
  return {
    id: `rev_${String(i + 1).padStart(3, '0')}`,
    productId: product.id,
    productName: product.name,
    productType: product.type,
    customerId: customer.id,
    customerName: `${customer.firstName} ${customer.lastName}`,
    rating,
    title,
    body,
    status,
    verifiedPurchase: rng.chance(0.8),
    helpfulCount: status === 'approved' ? rng.int(0, 24) : 0,
    createdAt: created,
    moderatedAt: status === 'pending' ? undefined : addMinutes(created, rng.int(60, 1800)),
    moderatedBy: status === 'pending' ? undefined : rng.pick(['Ibrahim Daher', 'Nasra Elmi']),
  };
});

// ─── Support tickets ────────────────────────────────────────────────────────
interface TicketDef {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  customer: number;
  withOrder: boolean;
  thread: [who: 'c' | 'a' | 'n', text: string][];
}

const TICKETS: TicketDef[] = [
  { subject: 'Where is my order SPX-10245?', category: 'delivery', priority: 'high', status: 'open', customer: 20, withOrder: true, thread: [['c', 'Hi, I placed order SPX-10245 this morning and chose express delivery. Can you confirm it will arrive today? I need the boots for a match tonight.']] },
  { subject: 'Wrong size received — Predator Elite', category: 'return', priority: 'normal', status: 'in_progress', customer: 3, withOrder: true, thread: [['c', 'I received size 43 but I ordered 42. How can I exchange?'], ['a', 'Sorry about that, Aicha. We have size 42 in stock and can swap it at your address. Is tomorrow afternoon convenient?'], ['n', 'Checked packing log — picker scanned wrong bin. Flagged to warehouse lead.'], ['c', 'Tomorrow after 4pm works. Thank you.']] },
  { subject: 'Payment declined but money deducted', category: 'payment', priority: 'urgent', status: 'open', customer: 5, withOrder: true, thread: [['c', 'My card payment failed on checkout but I see a pending charge on my bank app. Please help.']] },
  { subject: 'Do you have the Curry 11 in size 45?', category: 'product', priority: 'low', status: 'waiting_customer', customer: 11, withOrder: false, thread: [['c', 'Looking for Curry 11 in size 45, white colour.'], ['a', 'Hi Yacin, size 45 is not currently in stock. We expect a restock in about two weeks. Would you like us to notify you, or would size 44 work?']] },
  { subject: 'Change delivery address', category: 'order', priority: 'normal', status: 'resolved', customer: 8, withOrder: true, thread: [['c', 'Please deliver to my office in Plateau du Serpent instead of home.'], ['a', 'Done — the courier has the updated address.'], ['c', 'Great, thanks!']] },
  { subject: 'Team order for 15 jerseys', category: 'order', priority: 'high', status: 'in_progress', customer: 20, withOrder: false, thread: [['c', 'We need 15 Tiro 24 jerseys in black for our five-a-side league, sizes M to XL. Is there a team price?'], ['n', 'Check with store manager about bulk discount (>10 units).'], ['a', 'Hi John, we can offer a team price on 15 units. I will confirm sizes availability today.']] },
  { subject: 'Cannot log in to my account', category: 'account', priority: 'normal', status: 'in_progress', customer: 16, withOrder: false, thread: [['c', 'Password reset email is not arriving.']] },
  { subject: 'Refund status for returned tracksuit', category: 'return', priority: 'normal', status: 'waiting_customer', customer: 9, withOrder: true, thread: [['c', 'I returned the tracksuit last week, when will I get my refund?'], ['a', 'We received the return. Could you confirm the mobile money number for the refund?']] },
  { subject: 'Ball losing air after a week', category: 'product', priority: 'normal', status: 'closed', customer: 12, withOrder: true, thread: [['c', 'The basketball loses pressure after a few days.'], ['a', 'This is covered by warranty — we have arranged a replacement.'], ['c', 'Received the new one, thanks.']] },
  { subject: 'Delivery to Tadjourah — how long?', category: 'delivery', priority: 'low', status: 'resolved', customer: 5, withOrder: false, thread: [['c', 'How long does delivery to Tadjourah take?'], ['a', 'Regional delivery takes 3–5 business days.']] },
  { subject: 'Damaged box on arrival', category: 'order', priority: 'high', status: 'open', customer: 22, withOrder: true, thread: [['c', 'The shoe box arrived crushed. Shoes seem fine but this was a gift. Can I get a new box?']] },
  { subject: 'Invoice needed for company purchase', category: 'payment', priority: 'low', status: 'in_progress', customer: 28, withOrder: true, thread: [['c', 'Please send an invoice with our company name for accounting.'], ['a', 'Sure, please share the company name and address to print on the invoice.']] },
  { subject: 'Coupon WELCOME10 not working', category: 'payment', priority: 'normal', status: 'resolved', customer: 1, withOrder: false, thread: [['c', 'WELCOME10 says invalid at checkout.'], ['a', 'The coupon applies to orders from DJF 10,000. Your basket was just under — it should work now with the extra item.']] },
  { subject: 'Question about goalkeeper glove sizing', category: 'product', priority: 'low', status: 'closed', customer: 17, withOrder: false, thread: [['c', 'My hand is 20cm — which size?'], ['a', 'Size 9 is the best fit for a 20 cm hand.']] },
  { subject: 'Order cancelled without notice', category: 'order', priority: 'urgent', status: 'open', customer: 7, withOrder: true, thread: [['c', 'My order was cancelled and I did not receive any explanation. Why?']] },
  { subject: 'Exchange Pegasus 41 for different colour', category: 'return', priority: 'normal', status: 'in_progress', customer: 14, withOrder: true, thread: [['c', 'Can I exchange the volt Pegasus for black, same size?'], ['a', 'Yes — black size 41 is available. We will collect the volt pair on delivery.']] },
];

const AGENTS = [
  { id: 'adm_5', name: 'Nasra Elmi' },
  { id: 'adm_4', name: 'Kadra Youssouf' },
  { id: 'adm_2', name: 'Hodan Abdillahi' },
];

export const tickets: SupportTicket[] = TICKETS.map((t, i) => {
  const customer = customers[t.customer];
  const order = t.withOrder ? (i === 0 ? orders[0] : orders.find((o) => o.customerId === customer.id) ?? orders[(i * 3) % orders.length]) : undefined;
  const id = `tkt_${1040 - i}`;
  const created = i === 0 ? new Date(Date.now() - 42 * 60_000).toISOString() : daysAgo(Math.floor(i * 1.4), rng.int(8, 20), rng.int(0, 59));
  const assigned = t.status === 'open' && i % 2 === 0 ? undefined : AGENTS[i % AGENTS.length];
  let ts = created;
  const messages: TicketMessage[] = t.thread.map(([who, text], mi) => {
    ts = mi === 0 ? created : addMinutes(ts, rng.int(20, 300));
    if (new Date(ts).getTime() > Date.now()) ts = new Date(Date.now() - 5 * 60_000).toISOString();
    return {
      id: `${id}_m${mi + 1}`,
      ticketId: id,
      authorType: who === 'c' ? 'customer' : 'admin',
      authorName: who === 'c' ? `${customer.firstName} ${customer.lastName}` : assigned?.name ?? 'Nasra Elmi',
      body: text,
      internal: who === 'n',
      createdAt: ts,
    };
  });
  return {
    id,
    number: `TKT-${1040 - i}`,
    subject: t.subject,
    customerId: customer.id,
    customerName: `${customer.firstName} ${customer.lastName}`,
    customerEmail: customer.email,
    orderNumber: order?.number,
    category: t.category,
    priority: t.priority,
    status: t.status,
    assignedToId: assigned?.id,
    assignedToName: assigned?.name,
    messages,
    createdAt: created,
    updatedAt: messages[messages.length - 1].createdAt,
  };
});

// ─── Notifications ──────────────────────────────────────────────────────────
export const notifications: AdminNotification[] = [
  { id: 'ntf_01', type: 'new_order', title: 'New order SPX-10245', message: `${orders[0].customerName} placed an order for ${orders[0].itemsCount} item(s).`, link: '/orders/ord_10245', read: false, createdAt: orders[0].createdAt },
  { id: 'ntf_02', type: 'new_ticket', title: 'New support ticket TKT-1040', message: 'Where is my order SPX-10245?', link: '/support/tkt_1040', read: false, createdAt: tickets[0].createdAt },
  { id: 'ntf_03', type: 'low_stock', title: 'Low stock: Nike Mercurial Vapor 15 Elite FG', message: 'Black / 42 has fallen below its threshold.', link: '/inventory?status=low_stock', read: false, createdAt: daysAgo(0, 7, 40) },
  { id: 'ntf_04', type: 'payment_failed', title: 'Payment failed on SPX-10239', message: 'Card declined by issuer. Customer has been notified.', link: '/orders/ord_10239', read: false, createdAt: orders[6].createdAt },
  { id: 'ntf_05', type: 'review_pending', title: '6 reviews awaiting moderation', message: 'New product reviews need approval before they appear on the storefront.', link: '/reviews?status=pending', read: false, createdAt: daysAgo(0, 6, 10) },
  { id: 'ntf_06', type: 'refund_requested', title: 'Refund requested on SPX-10219', message: 'Customer reported a sizing issue.', link: '/orders/ord_10219', read: true, createdAt: daysAgo(1, 16, 5) },
  { id: 'ntf_07', type: 'new_customer', title: 'New customer registered', message: `${customers[0].firstName} ${customers[0].lastName} created an account.`, link: `/customers/${customers[0].id}`, read: true, createdAt: customers[0].joinedAt },
];

notifications.push(
  { id: 'ntf_09', type: 'low_stock', title: 'Out of stock: Molten BG5000 Basketball', message: 'Orange / 7 is out of stock.', link: '/inventory?status=out_of_stock', read: true, createdAt: daysAgo(2, 11, 20) },
  { id: 'ntf_10', type: 'new_ticket', title: 'Urgent ticket TKT-1038', message: 'Payment declined but money deducted', link: '/support/tkt_1038', read: true, createdAt: tickets[2].createdAt },
  { id: 'ntf_11', type: 'new_order', title: 'New order SPX-10244', message: `${orders[1].customerName} placed an order.`, link: '/orders/ord_10244', read: true, createdAt: orders[1].createdAt },
  { id: 'ntf_12', type: 'refund_requested', title: 'Refund requested on SPX-10210', message: 'Customer reported wrong item received.', link: '/orders/ord_10210', read: true, createdAt: daysAgo(4, 10, 0) },
  { id: 'ntf_13', type: 'new_customer', title: 'New customer registered', message: `${customers[1].firstName} ${customers[1].lastName} created an account.`, link: `/customers/${customers[1].id}`, read: true, createdAt: customers[1].joinedAt },
  { id: 'ntf_14', type: 'review_pending', title: 'Low rating review posted', message: '1-star review on a product needs attention.', link: '/reviews?rating=1', read: true, createdAt: daysAgo(5, 13, 0) },
);
