import { Fragment, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import type { TicketMessage } from '@/types';
import { Avatar } from '@/components/common';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime, formatTime } from '@/utils/format';

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(iso);
}

function Meta({ name, at, align }: { name: string; at: string; align: 'left' | 'right' }) {
  return (
    <p className={cn('mb-1 flex items-baseline gap-2 text-xs', align === 'right' && 'justify-end')}>
      <span className="font-semibold text-zinc-800">{name}</span>
      <time dateTime={at} title={formatDateTime(at)} className="text-zinc-500 tabular">
        {formatTime(at)}
      </time>
    </p>
  );
}

function MessageBubble({ m }: { m: TicketMessage }) {
  if (m.internal) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[85%] sm:max-w-[75%]">
          <div className="rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <Lock size={12} aria-hidden /> Internal note — not visible to customer
            </p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-amber-950">{m.body}</p>
            <p className="mt-2 text-xs text-amber-700">
              {m.authorName} · <time dateTime={m.createdAt} title={formatDateTime(m.createdAt)}>{formatTime(m.createdAt)}</time>
            </p>
          </div>
        </div>
      </div>
    );
  }
  const admin = m.authorType === 'admin';
  return (
    <div className={cn('flex items-end gap-2.5', admin && 'flex-row-reverse')}>
      <Avatar name={m.authorName} size={30} />
      <div className={cn('min-w-0 max-w-[85%] sm:max-w-[75%]', admin && 'text-right')}>
        <Meta name={admin ? `${m.authorName} · Support` : m.authorName} at={m.createdAt} align={admin ? 'right' : 'left'} />
        <div
          className={cn(
            'inline-block whitespace-pre-line rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed',
            admin ? 'rounded-br-md bg-ink-950 text-zinc-100' : 'rounded-bl-md border border-zinc-200 bg-white text-zinc-800 shadow-card',
          )}
        >
          {m.body}
        </div>
      </div>
    </div>
  );
}

/** Conversation with day separators; customer left, staff right, internal notes flagged. Auto-scrolls to latest. */
export function TicketThread({ messages }: { messages: TicketMessage[] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div ref={box} className="max-h-[min(62vh,680px)] min-h-[240px] space-y-5 overflow-y-auto bg-zinc-50/60 px-4 py-5 scrollbar-thin sm:px-6" role="log" aria-label="Ticket conversation" aria-live="polite">
      {messages.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">No messages yet.</p>}
      {messages.map((m, i) => {
        const showDay = i === 0 || new Date(messages[i - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString();
        return (
          <Fragment key={m.id}>
            {showDay && (
              <div className="flex items-center gap-3" role="separator">
                <span className="h-px flex-1 bg-zinc-200" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-400">{dayLabel(m.createdAt)}</span>
                <span className="h-px flex-1 bg-zinc-200" />
              </div>
            )}
            <MessageBubble m={m} />
          </Fragment>
        );
      })}
    </div>
  );
}
