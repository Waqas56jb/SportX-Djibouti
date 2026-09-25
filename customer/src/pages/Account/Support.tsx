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
import { t, useT } from '@/i18n';
import { apiFieldErrors, friendlyError } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { supportService } from '@/services/supportService';
import { toast } from '@/store/toastStore';
import type { TicketCategory, TicketStatus } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelative } from '@/utils/format';
import { minLength, required, validate } from '@/utils/validation';

const STATUS_TONE: Record<TicketStatus, BadgeTone> = { open: 'accent', 'in-progress': 'warning', 'waiting-customer': 'dark', resolved: 'success', closed: 'neutral' };

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
    const errs = validate(values, {
      subject: (v) => (!v.trim() ? t('account.support.errSubject') : v.trim().length < 3 ? t('account.support.errSubjectShort') : undefined),
      category: required(t('account.support.errTopic')),
      message: minLength(10, t('account.support.messageLabel')),
    });
    setErrors(errs);
    if (Object.keys(errs).length || !user) return;
    setSaving(true);
    try {
      const ticket = await supportService.create(user, { ...values, category: values.category as TicketCategory });
      toast.success(t('account.support.created'), { description: t('account.support.createdBody', { number: ticket.number }) });
      onCreated(ticket.id);
    } catch (err) {
      const fields = apiFieldErrors(err);
      setErrors({ subject: fields.subject, category: fields.category, orderNumber: fields.orderNumber, message: fields.message });
      if (!Object.keys(fields).length) toast.error(t('account.support.createError'), { description: friendlyError(err) });
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="space-y-5 px-5 py-6 sm:px-6">
        <TextField label={t('account.support.subject')} value={values.subject} onChange={(e) => setValues((v) => ({ ...v, subject: e.target.value }))} error={errors.subject} maxLength={120} />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label={t('account.support.topic')}
            placeholder={t('account.support.selectTopic')}
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value as TicketCategory }))}
            error={errors.category}
            options={Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            label={t('account.support.relatedOrder')}
            optional
            value={values.orderNumber}
            onChange={(e) => setValues((v) => ({ ...v, orderNumber: e.target.value }))}
            error={errors.orderNumber}
            options={[{ value: '', label: t('account.support.none') }, ...(orders.data ?? []).map((o) => ({ value: o.number, label: o.number }))]}
          />
        </div>
        <TextAreaField label={t('account.support.message')} value={values.message} onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))} error={errors.message} rows={6} maxLength={2000} />
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-paper-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {t('account.support.submit')}
        </Button>
      </div>
    </form>
  );
}

export function SupportPage() {
  useT();
  usePageMeta({ title: t('account.support.meta'), noindex: true });
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
      title={t('account.support.title')}
      description={t('account.support.description')}
      action={
        <Button variant="primary" onClick={() => setCreating(true)} leftIcon={<Plus className="h-4 w-4" />}>
          {t('account.support.newTicket')}
        </Button>
      }
    >
      <div className="mb-8 flex flex-col gap-4 border border-paper-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-3 text-sm sm:items-center">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" aria-hidden />
          <span>
            {t('account.support.callUs')}{' '}
            <a href={SITE.contact.phoneHref} className="ltr-text whitespace-nowrap font-semibold underline underline-offset-4">
              {SITE.contact.phone}
            </a>
          </span>
        </p>
        <Link to={ROUTES.faq} className="text-sm font-semibold underline underline-offset-4">
          {t('account.support.browseFaqs')}
        </Link>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <SkeletonLoader rows={3} />
      ) : !data?.length ? (
        <div className="border border-paper-200 bg-white">
          <EmptyState compact icon={<LifeBuoy />} title={t('account.support.emptyTitle')} description={t('account.support.emptyBody')} />
        </div>
      ) : (
        <ul className="divide-y divide-paper-200 border border-paper-200 bg-white">
          {data.map((ticket) => (
            <li key={ticket.id}>
              <Link to={ticketPath(ticket.id)} className="flex items-center gap-4 p-5 transition-colors hover:bg-paper-50 sm:p-6">
                <MessagesSquare className="hidden h-5 w-5 shrink-0 text-ink-500 sm:block" strokeWidth={1.5} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="ltr-text text-xs font-semibold text-ink-500">{ticket.number}</p>
                    <TicketStatusBadge status={ticket.status} />
                  </div>
                  <p className="mt-1.5 truncate text-[15px] font-semibold">{ticket.subject}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {TICKET_CATEGORY_LABELS[ticket.category]}
                    {ticket.orderNumber && (
                      <>
                        {' · '}
                        <span className="ltr-text">{ticket.orderNumber}</span>
                      </>
                    )}
                    {' · '}
                    {t('account.support.updated', { time: formatRelative(ticket.updatedAt) })} · {t('account.support.messages', { count: ticket.messageCount })}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal open={creating} onClose={closeNew} title={t('account.support.modalTitle')} size="lg">
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
  usePageMeta({ title: ticket ? `${ticket.number} — ${ticket.subject}` : t('account.support.ticketMeta'), noindex: true });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [ticket?.messages.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (reply.trim().length < 2) {
      setReplyError(t('account.support.replyEmpty'));
      return;
    }
    setSending(true);
    setReplyError(null);
    try {
      const updated = await supportService.reply(user!, id, reply);
      setData(updated);
      setReply('');
    } catch (err) {
      setReplyError(friendlyError(err));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <SkeletonLoader rows={3} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!ticket) {
    return (
      <div className="border border-paper-200 bg-white">
        <EmptyState compact icon={<LifeBuoy />} title={t('account.support.notFound')} action={<Link to={ROUTES.accountSupport} className="btn btn-primary">{t('account.support.backToSupport')}</Link>} />
      </div>
    );
  }

  const closed = ticket.status === 'closed';

  return (
    <div>
      <Link to={ROUTES.accountSupport} className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t('account.support.allTickets')}
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">
            <span className="ltr-text">{ticket.number}</span> · {TICKET_CATEGORY_LABELS[ticket.category]}
            {ticket.orderNumber && (
              <>
                {' · '}
                <span className="ltr-text">{ticket.orderNumber}</span>
              </>
            )}
          </p>
          <h1 className="heading-lg mt-2 break-words">{ticket.subject}</h1>
        </div>
        <TicketStatusBadge status={ticket.status} />
      </div>

      <section aria-label={t('account.support.conversation')} className="mt-8 border border-paper-200 bg-white">
        <ol className="max-h-[60vh] space-y-6 overflow-y-auto p-4 sm:p-8">
          {ticket.messages.map((m) => {
            const mine = m.author === 'customer';
            return (
              <li key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] sm:max-w-[70%]')}>
                  <p className={cn('mb-1.5 text-xs text-ink-500', mine && 'text-end')}>
                    <span className="font-semibold text-ink">{mine ? t('account.support.you') : m.authorName}</span> · {formatDateTime(m.createdAt)}
                  </p>
                  <div className={cn('whitespace-pre-line break-words px-4 py-3 text-[15px] leading-relaxed', mine ? 'bg-ink text-white' : 'border border-paper-200 bg-paper-50 text-ink')}>{m.body}</div>
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
                <Lock className="h-4 w-4 shrink-0" aria-hidden /> {t('account.support.closed')}
              </span>
            </InlineAlert>
          ) : (
            <form onSubmit={send} noValidate>
              <TextAreaField
                label={t('account.support.reply')}
                rows={3}
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value);
                  setReplyError(null);
                }}
                error={replyError ?? undefined}
                placeholder={t('account.support.replyPlaceholder')}
                maxLength={2000}
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-ink-500">{ticket.status === 'resolved' ? t('account.support.willReopen') : ticket.status === 'waiting-customer' ? t('account.support.waiting') : t('account.support.typical')}</p>
                <Button type="submit" variant="primary" loading={sending} leftIcon={<Send className="h-4 w-4" />} className="shrink-0 self-end sm:self-auto">
                  {t('common.actions.send')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
