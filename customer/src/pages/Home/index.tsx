import { CategoryShowcase } from '@/components/marketing/CategoryShowcase';
import { BestSellers, BasketballSpotlight, CampaignBanner, FootballSpotlight, TrainingCollection } from '@/components/marketing/Editorial';
import { FlashSale } from '@/components/marketing/FlashSale';
import { Hero } from '@/components/marketing/Hero';
import { NewArrivals } from '@/components/marketing/ProductShelf';
import { NewsletterSection, WhySportx } from '@/components/marketing/Benefits';
import { SITE } from '@/constants/site';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function HomePage() {
  usePageMeta({
    description: SITE.description,
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
      <BasketballSpotlight />
      <TrainingCollection />
      <FlashSale />
      <BestSellers />
      <WhySportx />
      <NewsletterSection />
    </>
  );
}
