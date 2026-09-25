import { Modal } from '@/components/common';
import { t } from '@/i18n';
import type { SizeGuideType } from '@/types';

type Table = { caption: string; head: string[]; rows: string[][]; note?: string };

/** Size tables for the football range. Built per render so headers follow the selected language. */
function tablesFor(type: Exclude<SizeGuideType, 'none'>): Table[] {
  const size = t('product.sizeGuide.size');
  switch (type) {
    case 'footwear':
      return [
        {
          caption: t('product.sizeGuide.footwearCaption'),
          head: [t('product.sizeGuide.eu'), t('product.sizeGuide.uk'), t('product.sizeGuide.us'), t('product.sizeGuide.footLength')],
          rows: [
            ['36', '3.5', '4', '22.5'],
            ['37', '4', '4.5', '23.0'],
            ['38', '5', '5.5', '24.0'],
            ['39', '6', '6.5', '24.5'],
            ['40', '6.5', '7', '25.0'],
            ['41', '7.5', '8', '26.0'],
            ['42', '8', '8.5', '26.5'],
            ['43', '9', '9.5', '27.5'],
            ['44', '9.5', '10', '28.0'],
            ['45', '10.5', '11', '29.0'],
            ['46', '11', '11.5', '29.5'],
          ],
          note: t('product.sizeGuide.footwearNote'),
        },
      ];
    case 'apparel':
      return [
        {
          caption: t('product.sizeGuide.apparelCaption'),
          head: [size, t('product.sizeGuide.chest'), t('product.sizeGuide.waist')],
          rows: [
            ['S', '88–96', '72–80'],
            ['M', '96–104', '80–88'],
            ['L', '104–112', '88–96'],
            ['XL', '112–120', '96–104'],
            ['XXL', '120–128', '104–112'],
          ],
          note: t('product.sizeGuide.apparelNote'),
        },
        {
          caption: t('product.sizeGuide.socksCaption'),
          head: [size, t('product.sizeGuide.shoeSize')],
          rows: [
            ['S', '35–38'],
            ['M', '39–42'],
            ['L', '43–46'],
          ],
        },
      ];
    case 'gloves':
      return [
        {
          caption: t('product.sizeGuide.glovesCaption'),
          head: [size, t('product.sizeGuide.handCircumference'), t('product.sizeGuide.handLength')],
          rows: [
            ['7', '17–18', '16.5–17.5'],
            ['8', '18–19.5', '17.5–18.5'],
            ['9', '19.5–21', '18.5–19.5'],
            ['10', '21–22.5', '19.5–20.5'],
            ['11', '22.5–24', '20.5–21.5'],
          ],
          note: t('product.sizeGuide.glovesNote'),
        },
      ];
    case 'ball':
      return [
        {
          caption: t('product.sizeGuide.ballCaption'),
          head: [size, t('product.sizeGuide.recommendedFor'), t('product.sizeGuide.circumference'), t('product.sizeGuide.weight')],
          rows: [
            [t('product.sizeGuide.ballSize', { n: 4 }), t('product.sizeGuide.ages8to12'), '63.5–66 cm', '350–390 g'],
            [t('product.sizeGuide.ballSize', { n: 5 }), t('product.sizeGuide.ages12plus'), '68–70 cm', '410–450 g'],
          ],
          note: t('product.sizeGuide.ballNote'),
        },
      ];
  }
}

function SizeTable({ table }: { table: Table }) {
  return (
    <div>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[320px] border-collapse text-start text-sm">
          <caption className="mb-3 text-start text-xs font-semibold uppercase tracking-[0.12em] text-ink-700">{table.caption}</caption>
          <thead>
            <tr className="border-b border-ink">
              {table.head.map((h) => (
                <th key={h} scope="col" className="py-3 pe-4 text-start text-xs font-semibold uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r[0]} className="border-b border-paper-200 odd:bg-paper-50">
                {r.map((c, i) => (
                  <td key={i} className={i === 0 ? 'whitespace-nowrap py-3 pe-4 font-semibold' : 'py-3 pe-4 tabular-nums text-ink-600'}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && <p className="mt-4 text-sm text-ink-500">{table.note}</p>}
    </div>
  );
}

/**
 * `category` (product category slug) narrows the apparel guide: socks get the sock chart only,
 * other apparel the body chart only. Without it both charts are shown.
 */
export function SizeGuideTable({ type, category }: { type: SizeGuideType; category?: string }) {
  if (type === 'none') return <p className="text-ink-500">{t('product.sizeGuide.oneSize')}</p>;
  let tables = tablesFor(type);
  if (type === 'apparel' && category) tables = category === 'socks' ? tables.slice(1) : tables.slice(0, 1);
  return (
    <div className="space-y-10">
      {tables.map((table) => (
        <SizeTable key={table.caption} table={table} />
      ))}
    </div>
  );
}

export function SizeGuideModal({ open, onClose, type, category }: { open: boolean; onClose: () => void; type: SizeGuideType; category?: string }) {
  return (
    <Modal open={open} onClose={onClose} title={t('product.sizeGuide.title')} size="lg">
      <div className="px-5 py-6 sm:px-6">
        <SizeGuideTable type={type} category={category} />
      </div>
    </Modal>
  );
}
