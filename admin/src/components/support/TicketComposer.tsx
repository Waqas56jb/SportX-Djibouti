import { useRef, useState, type KeyboardEvent } from 'react';
import { Lock, MessageSquareReply, Send, StickyNote, Zap } from 'lucide-react';
import { Button, Kbd, Menu } from '@/components/common';
import { cn } from '@/utils/cn';

export type ComposerMode = 'reply' | 'note';

const QUICK_REPLIES = [
  { label: 'Acknowledge', text: 'Hello {name},\n\nThank you for reaching out to SPORTX. We’ve received your message and are looking into it now. We’ll get back to you shortly.\n\nBest regards,\nSPORTX Support' },
  { label: 'Delivery update', text: 'Hello {name},\n\nYour order is on its way with our Djibouti delivery partner. You’ll receive an SMS with the courier’s contact on the day of delivery.\n\nBest regards,\nSPORTX Support' },
  { label: 'Return instructions', text: 'Hello {name},\n\nYou can return unworn items within 14 days. Please bring the item with its original packaging to our store, or reply here and we’ll arrange a pickup.\n\nBest regards,\nSPORTX Support' },
  { label: 'Refund processed', text: 'Hello {name},\n\nYour refund has been processed. Depending on your payment method, it may take 3–5 business days to appear.\n\nBest regards,\nSPORTX Support' },
  { label: 'Request more details', text: 'Hello {name},\n\nCould you share your order number and a photo of the item so we can help you faster?\n\nBest regards,\nSPORTX Support' },
];

export interface TicketComposerProps {
  customerFirstName: string;
  onSend: (body: string, mode: ComposerMode) => Promise<boolean>;
  disabled?: boolean;
  closed?: boolean;
}

/** Reply / internal-note composer. Ctrl/Cmd+Enter sends. */
export function TicketComposer({ customerFirstName, onSend, disabled, closed }: TicketComposerProps) {
  const [mode, setMode] = useState<ComposerMode>('reply');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const note = mode === 'note';

  const send = async () => {
    if (!body.trim() || sending || disabled) return;
    setSending(true);
    const ok = await onSend(body, mode);
    setSending(false);
    if (ok) setBody('');
    area.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send();
    }
  };

  const insert = (text: string) => {
    setMode('reply');
    setBody(text.replace('{name}', customerFirstName));
    requestAnimationFrame(() => area.current?.focus());
  };

  return (
    <div className={cn('border-t transition-colors', note ? 'border-amber-200 bg-amber-50/60' : 'border-zinc-100 bg-white')}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 sm:px-5">
        <div role="radiogroup" aria-label="Message type" className="inline-flex rounded-lg bg-zinc-100 p-0.5">
          {(
            [
              { v: 'reply', label: 'Reply to customer', icon: MessageSquareReply },
              { v: 'note', label: 'Internal note', icon: StickyNote },
            ] as const
          ).map((t) => {
            const on = mode === t.v;
            return (
              <button
                key={t.v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMode(t.v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                  on ? (t.v === 'note' ? 'bg-amber-100 text-amber-900 shadow-sm ring-1 ring-amber-300' : 'bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200/70') : 'text-zinc-500 hover:text-zinc-800',
                )}
              >
                <t.icon size={14} aria-hidden /> {t.label}
              </button>
            );
          })}
        </div>
        {!note && (
          <Menu
            label="Quick replies"
            width={220}
            header={<div className="px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wider text-zinc-400">Quick replies</div>}
            items={QUICK_REPLIES.map((q) => ({ label: q.label, onSelect: () => insert(q.text) }))}
            trigger={(p) => (
              <Button {...p} size="sm" variant="ghost" icon={Zap}>
                Quick replies
              </Button>
            )}
          />
        )}
      </div>

      <div className="px-4 pb-4 pt-3 sm:px-5">
        {note && (
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <Lock size={12} aria-hidden /> Only your team can see internal notes.
          </p>
        )}
        {closed && !note && <p className="mb-2 text-xs text-zinc-500">This ticket is closed. The customer will still receive your reply by email.</p>}
        <label htmlFor="ticket-composer" className="sr-only">
          {note ? 'Internal note' : 'Reply to customer'}
        </label>
        <textarea
          id="ticket-composer"
          ref={area}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKey}
          rows={4}
          maxLength={4000}
          disabled={disabled}
          placeholder={note ? 'Add context for your team — not sent to the customer…' : `Write a reply to ${customerFirstName}…`}
          className={cn(
            'block w-full resize-y rounded-lg border px-3 py-2.5 text-sm leading-relaxed shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2',
            note ? 'border-dashed border-amber-400 bg-white focus:border-amber-500 focus:ring-amber-500/20' : 'border-zinc-200 bg-white focus:border-zinc-900 focus:ring-zinc-900/10',
          )}
        />
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="hidden items-center gap-1 text-xs text-zinc-500 sm:inline-flex">
            <Kbd>Ctrl</Kbd>
            <span aria-hidden>+</span>
            <Kbd>Enter</Kbd>
            <span className="ml-1">to send</span>
          </span>
          <Button variant={note ? 'secondary' : 'primary'} icon={note ? StickyNote : Send} onClick={() => void send()} loading={sending} disabled={!body.trim() || disabled} className={cn('ml-auto', note && 'border-amber-300 bg-amber-100 text-amber-900 hover:border-amber-400 hover:bg-amber-200')}>
            {note ? 'Add internal note' : 'Send reply'}
          </Button>
        </div>
      </div>
    </div>
  );
}
