import { Modal } from '@/components/common';
import type { SizeGuideType } from '@/types';

type Table = { caption: string; head: string[]; rows: string[][]; note: string };

const TABLES: Record<Exclude<SizeGuideType, 'none'>, Table> = {
  footwear: {
    caption: 'Footwear sizing (EU)',
    head: ['EU', 'UK', 'US Men', 'US Women', 'Foot length (cm)'],
    rows: [
      ['36', '3.5', '4.5', '6', '22.5'],
      ['37', '4', '5', '6.5', '23.2'],
      ['38', '5', '6', '7.5', '23.9'],
      ['39', '6', '7', '8.5', '24.6'],
      ['40', '6.5', '7.5', '9', '25.3'],
      ['41', '7.5', '8.5', '10', '26.0'],
      ['42', '8', '9', '10.5', '26.7'],
      ['43', '9', '10', '11.5', '27.4'],
      ['44', '9.5', '10.5', '12', '28.1'],
      ['45', '10.5', '11.5', '13', '28.8'],
      ['46', '11', '12', '13.5', '29.5'],
    ],
    note: 'Measure your foot from heel to longest toe while standing. If you are between sizes, choose the larger size.',
  },
  apparel: {
    caption: 'Apparel sizing',
    head: ['Size', 'Chest (cm)', 'Waist (cm)', 'Hip (cm)'],
    rows: [
      ['XS', '82–88', '66–72', '82–88'],
      ['S', '88–94', '72–78', '88–94'],
      ['M', '94–100', '78–84', '94–100'],
      ['L', '100–106', '84–90', '100–106'],
      ['XL', '106–112', '90–96', '106–112'],
      ['XXL', '112–118', '96–102', '112–118'],
    ],
    note: 'Measure around the fullest part of your chest and hips, and the narrowest part of your waist. Athletic fits sit closer to the body.',
  },
  gloves: {
    caption: 'Glove sizing',
    head: ['Size', 'Hand circumference (cm)', 'Hand length (cm)'],
    rows: [
      ['S', '17–19', '17–18'],
      ['M', '19–21', '18–19'],
      ['L', '21–23', '19–20'],
      ['XL', '23–25', '20–21'],
    ],
    note: 'Measure around your palm just below the knuckles, excluding the thumb.',
  },
  ball: {
    caption: 'Ball sizing',
    head: ['Size', 'Recommended for', 'Circumference'],
    rows: [
      ['Football Size 3', 'Ages 8 and under', '58–61 cm'],
      ['Football Size 4', 'Ages 8–12', '63.5–66 cm'],
      ['Football Size 5', 'Ages 12+ / adult', '68–70 cm'],
      ['Basketball Size 5', 'Ages 9–11', '69–71 cm'],
      ['Basketball Size 6', 'Ages 12+ women', '72–74 cm'],
      ['Basketball Size 7', 'Ages 15+ men', '75–78 cm'],
    ],
    note: 'Official match sizes: football Size 5, men’s basketball Size 7, women’s basketball Size 6.',
  },
};

export function SizeGuideTable({ type }: { type: SizeGuideType }) {
  if (type === 'none') return <p className="text-ink-500">This product is one size.</p>;
  const t = TABLES[type];
  return (
    <div>
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[420px] border-collapse text-left text-sm">
          <caption className="mb-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-700">{t.caption}</caption>
          <thead>
            <tr className="border-b border-ink">
              {t.head.map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap py-3 pr-4 text-xs font-semibold uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r[0]} className="border-b border-paper-200 odd:bg-paper-50">
                {r.map((c, i) => (
                  <td key={i} className={i === 0 ? 'py-3 pr-4 font-semibold' : 'py-3 pr-4 tabular-nums text-ink-600'}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-ink-500">{t.note}</p>
    </div>
  );
}

export function SizeGuideModal({ open, onClose, type }: { open: boolean; onClose: () => void; type: SizeGuideType }) {
  return (
    <Modal open={open} onClose={onClose} title="Size Guide" size="lg">
      <div className="px-5 py-6 sm:px-6">
        <SizeGuideTable type={type} />
      </div>
    </Modal>
  );
}
