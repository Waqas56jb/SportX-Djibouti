import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { Campaign, CampaignInput, CampaignStatus, CampaignType } from '@/types';
import { Button } from '@/components/common';
import { DateInput, FileDropzone, FormGrid, Input, MultiSelect, RadioGroup, Select, Textarea } from '@/components/forms';
import { Drawer } from '@/components/modals/Overlay';
import { campaignService } from '@/services/campaignService';
import { ApiError } from '@/services/api';
import { CAMPAIGN_TYPES } from '@/constants/catalog';
import { toast } from '@/store/toastStore';
import { CampaignBanner } from './CampaignBanner';
import type { MarketingCatalog } from './useMarketingData';
import { applyApiErrors, endOfDayIso, errorMessage, fromLocalInput, toLocalDateInput } from './utils';

type EditableStatus = Extract<CampaignStatus, 'draft' | 'scheduled' | 'active' | 'paused'>;

interface FormState {
  name: string;
  type: CampaignType;
  description: string;
  /** Preview URL: the stored banner or an object URL for a newly picked file. */
  bannerUrl?: string;
  /** New banner to upload after saving. */
  bannerFile?: File;
  productIds: string[];
  categoryIds: string[];
  startDate: string;
  endDate: string;
  status: EditableStatus;
}
type Errors = Partial<Record<keyof FormState, string>>;
const FIELDS = ['name', 'type', 'description', 'productIds', 'categoryIds', 'startDate', 'endDate', 'status'] as const satisfies readonly (keyof FormState)[];
const ALIAS: Record<string, (typeof FIELDS)[number]> = { startsAt: 'startDate', endsAt: 'endDate' };

const STATUS_OPTIONS: { value: EditableStatus; label: string; description: string }[] = [
  { value: 'draft', label: 'Draft', description: 'Not visible to customers' },
  { value: 'scheduled', label: 'Scheduled', description: 'Goes live on the start date' },
  { value: 'active', label: 'Active', description: 'Live on the storefront now' },
  { value: 'paused', label: 'Paused', description: 'Temporarily hidden' },
];

const isEditable = (s: CampaignStatus): s is EditableStatus => ['draft', 'scheduled', 'active', 'paused'].includes(s);

function toForm(c?: Campaign): FormState {
  const start = new Date();
  start.setDate(start.getDate() + 3);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  return {
    name: c?.name ?? '',
    type: c?.type ?? 'seasonal',
    description: c?.description ?? '',
    bannerUrl: c?.bannerUrl,
    productIds: c ? [...c.productIds] : [],
    categoryIds: c ? [...c.categoryIds] : [],
    startDate: toLocalDateInput(c?.startsAt ?? start.toISOString()),
    endDate: toLocalDateInput(c?.endsAt ?? end.toISOString()),
    status: c && isEditable(c.status) ? c.status : 'draft',
  };
}

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 3) e.name = 'Campaign name needs at least 3 characters.';
  if (f.description.length > 280) e.description = 'Keep the description under 280 characters.';
  if (!f.startDate) e.startDate = 'Start date is required.';
  if (!f.endDate) e.endDate = 'End date is required.';
  else if (f.startDate && endOfDayIso(f.endDate) <= fromLocalInput(f.startDate)) e.endDate = 'End date can’t be before the start date.';
  if (f.status === 'scheduled' && f.startDate && f.startDate <= toLocalDateInput(new Date().toISOString())) e.status = 'Scheduled campaigns need a start date after today — or choose Active.';
  if (f.status === 'active' && f.endDate && endOfDayIso(f.endDate) < new Date().toISOString()) e.status = 'This campaign has already ended — choose Draft or move the end date.';
  return e;
}

export function CampaignFormDrawer({ open, campaign, onClose, onSaved, catalog }: { open: boolean; campaign?: Campaign; onClose: () => void; onSaved: (c: Campaign, created: boolean) => void; catalog: MarketingCatalog }) {
  const [form, setForm] = useState<FormState>(() => toForm());
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const objectUrl = useRef<string | null>(null);
  const releasePreview = () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  };

  useEffect(() => {
    if (!open) return;
    releasePreview();
    setForm(toForm(campaign));
    setErrors({});
  }, [open, campaign]);
  useEffect(() => releasePreview, []);

  const pickBanner = (file: File) => {
    releasePreview();
    objectUrl.current = URL.createObjectURL(file);
    setForm((f) => ({ ...f, bannerFile: file, bannerUrl: objectUrl.current ?? undefined }));
  };
  const clearBanner = () => {
    releasePreview();
    setForm((f) => ({ ...f, bannerFile: undefined, bannerUrl: undefined }));
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    const input: CampaignInput = {
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim(),
      productIds: form.productIds,
      categoryIds: form.categoryIds,
      startsAt: fromLocalInput(form.startDate),
      endsAt: endOfDayIso(form.endDate),
      status: form.status,
    };
    setSaving(true);
    try {
      let saved = campaign ? await campaignService.updateCampaign(campaign.id, input) : await campaignService.createCampaign(input);
      try {
        if (form.bannerFile) saved = await campaignService.uploadBanner(saved.id, form.bannerFile);
        else if (!form.bannerUrl && saved.bannerUrl) saved = await campaignService.removeBanner(saved.id);
      } catch (bannerErr) {
        toast.error('Campaign saved, but the banner couldn’t be updated.', { description: errorMessage(bannerErr) });
      }
      toast.success(campaign ? 'Campaign updated.' : 'Campaign created.', { description: saved.name });
      onSaved(saved, !campaign);
    } catch (err) {
      const flagged = applyApiErrors(err, FIELDS, (x) => setErrors((prev) => ({ ...prev, ...x })), ALIAS);
      // 409: e.g. activating a campaign whose end date has passed.
      if (!flagged && err instanceof ApiError && err.status === 409) setErrors((prev) => ({ ...prev, status: err.message }));
      toast.error('Couldn’t save campaign.', { description: flagged ? `${errorMessage(err)} Check the highlighted fields.` : errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      dismissible={!saving}
      width="xl"
      title={campaign ? 'Edit campaign' : 'Create campaign'}
      description="Storefront campaigns group products and categories behind a banner and a schedule."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="campaign-form" loading={saving}>
            {campaign ? 'Save changes' : 'Create campaign'}
          </Button>
        </>
      }
    >
      <form id="campaign-form" onSubmit={submit} noValidate className="space-y-5">
        <FormGrid cols={2}>
          <Input label="Campaign name" required value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} maxLength={120} placeholder="e.g. Derby Week" data-autofocus />
          <Select label="Type" required value={form.type} onChange={(e) => set('type', e.target.value as CampaignType)} options={CAMPAIGN_TYPES} />
        </FormGrid>
        <Textarea label="Description" optional value={form.description} onChange={(e) => set('description', e.target.value)} error={errors.description} maxLength={280} showCount rows={3} placeholder="What the campaign is about and who it targets." />

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[0.8125rem] font-medium text-zinc-800">
              Banner image <span className="ml-1 text-xs font-normal text-zinc-400">Optional</span>
            </span>
            {form.bannerUrl && (
              <button type="button" onClick={clearBanner} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
                <Trash2 size={12} aria-hidden /> Remove image
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <CampaignBanner name={form.name.trim()} type={form.type} src={form.bannerUrl} className="aspect-[16/7] w-full rounded-xl" />
            <FileDropzone
              compact
              multiple={false}
              accept="image/jpeg,image/png,image/webp,image/avif"
              maxSizeMb={5}
              title={form.bannerUrl ? 'Replace banner' : 'Upload banner'}
              hint="1600 × 700 recommended · JPEG, PNG, WebP or AVIF · up to 5 MB"
              onFiles={([f]) => f && pickBanner(f)}
              onReject={(m) => toast.error('Image not added.', { description: m })}
            />
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">Without an image, a branded typographic banner is generated automatically.</p>
        </div>

        <FormGrid cols={2}>
          <MultiSelect label="Products" optional options={catalog.productOptions} value={form.productIds} onChange={(v) => set('productIds', v)} error={errors.productIds} placeholder={catalog.loading ? 'Loading…' : 'Choose products'} maxChips={3} />
          <MultiSelect label="Categories" optional options={catalog.categoryOptions} value={form.categoryIds} onChange={(v) => set('categoryIds', v)} error={errors.categoryIds} placeholder={catalog.loading ? 'Loading…' : 'Choose categories'} maxChips={3} />
          <DateInput label="Start date" required value={form.startDate} onChange={(e) => set('startDate', e.target.value)} error={errors.startDate} />
          <DateInput label="End date" required value={form.endDate} min={form.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} error={errors.endDate} />
        </FormGrid>

        <RadioGroup label="Status" variant="cards" columns={2} value={form.status} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} error={errors.status} />
        {campaign && !isEditable(campaign.status) && <p className="text-xs text-zinc-500">This campaign is currently {campaign.status}. Saving will move it to the status selected above.</p>}
      </form>
    </Drawer>
  );
}
