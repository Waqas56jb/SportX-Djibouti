import { ArrowLeft, ChevronRight, LifeBuoy, Lock, MessagesSquare, Phone, Plus, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AccountSection } from '@/components/account/AccountLayout';
import { Badge, Button, EmptyState, ErrorState, InlineAlert, Modal, SelectField, SkeletonLoader, TextAreaField, TextField, type BadgeTone } from '@/components/common';
import { TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS } from '@/constants/labels';
import { ROUTES, ticketPath } from '@/constants/routes';
import { SITE } from '@/constants/site';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { usePageMeta } from '@/hooks/usePageMeta';
import { errorMessage, orderService, supportService } from '@/services';
import { toast } from '@/store/toastStore';
import type { TicketCategory, TicketStatus } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelative } from '@/utils/format';
import { minLength, required, validate } from '@/utils/validation';

const STATUS_TONE: Record<TicketStatus, BadgeTone> = { open: 'accent', 'in-progress': 'warning', resolved: 'success', closed: 'neutral' };

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {TICKET_STATUS_LABELS[status]}
    </Badge>
  );
}

function NewTicketForm({ defaultOrder, onCreated, onCancel }: { defaultOrder?: string; onCreated: (id: string) => void; onCancel: () => void }) {
  const { user } = useAuth();
  const orders = useAsync(() => orderService.listForUser(user!.id, user!.email), [user?.id]);
  const [values, setValues] = useState({ subject: '', category: (defaultOrder ? 'order' : '') as TicketCategory | '', orderNumber: defaultOrder ?? '', message: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(values, { subject: required('Add a subject'), category: required('Choose a topic'), message: minLength(10, 'Message') });
    setErrors(errs);
    if (Object.keys(errs).length || !user) return;
    setSaving(true);
    try {
      const ticket = await supportService.create(user, { ...values, category: values.category as TicketCategory });
      toast.success('Ticket created', { description: `${ticket.number} — our team will respond shortly.` });
      onCreated(ticket.id);
    } catch (err) {
      toast.error('Could not create ticket', { description: errorMessage(err) });
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="space-y-5 px-5 py-6 sm:px-6">
        <TextField label="Subject" value={values.subject} onChange={(e) => setValues((v) => ({ ...v, subject: e.target.value }))} error={errors.subject} maxLength={120} />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Topic"
            placeholder="Select a topic"
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value as TicketCategory }))}
            error={errors.category}
            options={Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            label="Related order"
            optional
            value={values.orderNumber}
            onChange={(e) => setValues((v) => ({ ...v, orderNumber: e.target.value }))}
            options={[{ value: '', label: 'None' }, ...(orders.data ?? []).map((o) => ({ value: o.number, label: o.number }))]}
          />
        </div>
        <TextAreaField label="How can we help?" value={values.message} onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))} error={errors.message} rows={6} maxLength={2000} />
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-paper-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Submit ticket
        </Button>
      </div>
    </form>
  );
}

export function SupportPage() {
  usePageMeta({ title: 'Support', noindex: true });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const orderParam = params.get('order') ?? undefined;
  const { data, loading, error, reload } = useAsync(() => supportService.list(user!.id), [user?.id]);
  const [creating, setCreating] = useState(Boolean(orderParam));

  const closeNew = () => {
    setCreating(false);
    if (orderParam) setParams({}, { replace: true });
  };

  return (
    <AccountSection
      title="Support"
      description="Questions about an order, delivery or product? We’re here to help."
      action={
        <Button variant="primary" onClick={() => setCreating(true)} leftIcon={<Plus className="h-4 w-4" />}>
          New ticket
        </Button>
      }
    >
      <div className="mb-8 flex flex-col gap-4 border border-paper-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-3 text-sm">
          <Phone className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Prefer to talk? Call us on{' '}
            <a href={SITE.contact.phoneHref} className="font-semibold underline underline-offset-4">
              {SITE.contact.phone}
            </a>
          </span>
        </p>
        <Link to={ROUTES.faq} className="text-sm font-semibold underline underline-offset-4">
          Browse FAQs
        </Link>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <SkeletonLoader rows={3} />
      ) : !data?.length ? (
        <div className="border border-paper-200 bg-white">
          <EmptyState compact icon={<LifeBuoy />} title="No support tickets" description="Create a ticket and our team will get back to you." />
        </div>
      ) : (
        <ul className="divide-y divide-paper-200 border border-paper-200 bg-white">
          {data.map((t) => (
            <li key={t.id}>
              <Link to={ticketPath(t.id)} className="flex items-center gap-4 p-5 transition-colors hover:bg-paper-50 sm:p-6">
                <MessagesSquare className="hidden h-5 w-5 shrink-0 text-ink-500 sm:block" strokeWidth={1.5} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-xs font-semibold text-ink-500">{t.number}</p>
                    <TicketStatusBadge status={t.status} />
                  </div>
                  <p className="mt-1.5 truncate text-[15px] font-semibold">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {TICKET_CATEGORY_LABELS[t.category]}
                    {t.orderNumber && ` · ${t.orderNumber}`} · Updated {formatRelative(t.updatedAt)} · {t.messages.length} messages
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal open={creating} onClose={closeNew} title="New support ticket" size="lg">
        <NewTicketForm defaultOrder={orderParam} onCancel={closeNew} onCreated={(id) => navigate(ticketPath(id))} />
      </Modal>
    </AccountSection>
  );
}

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data: ticket, loading, error, reload, setData } = useAsync(() => supportService.get(user!.id, id), [id, user?.id]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  usePageMeta({ title: ticket ? `${ticket.number} — ${ticket.subject}` : 'Support ticket', noindex: true });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [ticket?.messages.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (reply.trim().length < 2) {
      setReplyError('Write a message before sending');
      return;
    }
    setSending(true);
    setReplyError(null);
    try {
      const updated = await supportService.reply(user!, id, reply);
      setData(updated);
      setReply('');
    } catch (err) {
      setReplyError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <SkeletonLoader rows={3} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!ticket) {
    return (
      <div className="border border-paper-200 bg-white">
        <EmptyState compact icon={<LifeBuoy />} title="Ticket not found" action={<Link to={ROUTES.accountSupport} className="btn btn-primary">Back to support</Link>} />
      </div>
    );
  }

  const closed = ticket.status === 'closed';

  return (
    <div>
      <Link to={ROUTES.accountSupport} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All tickets
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">
            {ticket.number} · {TICKET_CATEGORY_LABELS[ticket.category]}
            {ticket.orderNumber && ` · ${ticket.orderNumber}`}
          </p>
          <h1 className="heading-lg mt-2">{ticket.subject}</h1>
        </div>
        <TicketStatusBadge status={ticket.status} />
      </div>

      <section aria-label="Conversation" className="mt-8 border border-paper-200 bg-white">
        <ol className="max-h-[60vh] space-y-6 overflow-y-auto p-5 sm:p-8">
          {ticket.messages.map((m) => {
            const mine = m.author === 'customer';
            return (
              <li key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] sm:max-w-[70%]')}>
                  <p className={cn('mb-1.5 text-xs text-ink-500', mine && 'text-right')}>
                    <span className="font-semibold text-ink">{mine ? 'You' : m.authorName}</span> · {formatDateTime(m.createdAt)}
                  </p>
                  <div className={cn('px-4 py-3 text-[15px] leading-relaxed', mine ? 'bg-ink text-white' : 'border border-paper-200 bg-paper-50 text-ink')}>{m.body}</div>
                </div>
              </li>
            );
          })}
          <div ref={endRef} />
        </ol>
        <div className="border-t border-paper-200 p-5 sm:p-6">
          {closed ? (
            <InlineAlert>
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" aria-hidden /> This ticket is closed. Open a new ticket if you need more help.
              </span>
            </InlineAlert>
          ) : (
            <form onSubmit={send} noValidate>
              <TextAreaField
                label="Reply"
                rows={3}
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value);
                  setReplyError(null);
                }}
                error={replyError ?? undefined}
                placeholder="Write your message…"
                maxLength={2000}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-ink-500">{ticket.status === 'resolved' ? 'Replying will reopen this ticket.' : 'Our team typically replies within one business day.'}</p>
                <Button type="submit" variant="primary" loading={sending} leftIcon={<Send className="h-4 w-4" />}>
                  Send
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
