import { CategoryShowcase } from '@/components/marketing/CategoryShowcase';
import { CeoMessage } from '@/components/marketing/CeoMessage';
import { BestSellers, CampaignBanner, FootballSpotlight, TeamwearSpotlight, TrainingCollection } from '@/components/marketing/Editorial';
import { FlashSale } from '@/components/marketing/FlashSale';
import { Hero } from '@/components/marketing/Hero';
import { NewArrivals } from '@/components/marketing/ProductShelf';
import { NewsletterSection, WhySportx } from '@/components/marketing/Benefits';
import { SITE } from '@/constants/site';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useT } from '@/i18n';

export default function HomePage() {
  const { t } = useT();
  usePageMeta({
    title: t('home.meta.title'),
    description: t('common.site.description'),
    path: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SportingGoodsStore',
      name: SITE.name,
      slogan: SITE.tagline,
      url: SITE.url,
      telephone: SITE.contact.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Place Menelik, Rue de Ras Makonnen',
        addressLocality: 'Djibouti',
        addressCountry: 'DJ',
      },
    },
  });

  return (
    <>
      <Hero />
      <CategoryShowcase />
      <NewArrivals />
      <CampaignBanner />
      <FootballSpotlight />
      <TeamwearSpotlight />
      <CeoMessage />
      <TrainingCollection />
      <FlashSale />
      <BestSellers />
      <WhySportx />
      <NewsletterSection />
    </>
  );
}
