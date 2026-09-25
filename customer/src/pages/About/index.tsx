import { ArrowRight } from 'lucide-react';
import { ButtonLink, Reveal, SmartImage } from '@/components/common';
import { PageHero } from '@/components/marketing/PageHero';
import { SITE } from '@/constants/site';
import { IMG } from '@/data/images';
import { usePageMeta } from '@/hooks/usePageMeta';

const PILLARS = [
  { title: 'Performance', text: 'Every product earns its place by how it performs — under load, at pace and in the heat of competition.' },
  { title: 'Quality', text: 'Durable materials, precise construction and finishes that hold up to daily training, season after season.' },
  { title: 'Athletes', text: 'Footballers, hoopers, runners and lifters. Individuals, schools, gyms and clubs. We build our range around them.' },
  { title: 'Training', text: 'The work that happens away from the crowd. We equip the sessions that turn potential into performance.' },
  { title: 'Competition', text: 'Match-grade balls, boots and kit built to the standard that competitive sport demands.' },
  { title: 'Culture', text: 'Sport is how a city moves. We celebrate modern sports culture — on the pitch, on the court and on the street.' },
];

export default function AboutPage() {
  usePageMeta({
    title: 'About SPORTX',
    description: 'SPORTX is a premium sportswear and equipment company in Djibouti, focused on performance, quality and the athletes who demand more.',
  });

  return (
    <>
      <PageHero
        eyebrow="About SPORTX"
        title="Built for athletes who demand more"
        description="Premium sportswear, footwear and equipment — selected, tested and delivered for the way Djibouti moves."
        image={IMG.runBlocks}
        crumbs={[{ label: 'About' }]}
        size="lg"
      />

      <section className="container-site grid grid-cols-1 gap-12 py-20 sm:py-28 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
        <Reveal>
          <p className="eyebrow">Our story</p>
          <h2 className="heading-xl mt-4">
            Move.
            <br />
            Train.
            <br />
            <span className="text-accent-dark">Perform.</span>
          </h2>
        </Reveal>
        <Reveal delay={100} className="space-y-6 text-lg leading-relaxed text-ink-600">
          <p>
            SPORTX exists for one reason: to give athletes the gear they need to perform at their best. From our home at Place Menelik, we serve football players,
            basketball players, runners, gyms, schools, clubs and professional teams — and everyone who simply loves to move.
          </p>
          <p>
            We believe premium performance equipment should be accessible, not imported as an afterthought. That means a carefully selected range, honest product
            information, sizes that fit and a shopping experience that respects your time — online and in store.
          </p>
          <p className="font-semibold text-ink">Whether you’re preparing for match day or your first 5K, SPORTX is built to get you there.</p>
        </Reveal>
      </section>

      <section className="grid lg:grid-cols-2" aria-label="SPORTX in action">
        <div className="relative min-h-[360px] sm:min-h-[520px]">
          <SmartImage src={IMG.fbDuel} alt="Footballers competing for the ball" sizes="(min-width: 1024px) 50vw, 100vw" wrapperClassName="absolute inset-0" />
        </div>
        <div className="grid grid-cols-2">
          <div className="relative min-h-[260px]">
            <SmartImage src={IMG.bbGame} alt="Basketball game in progress" sizes="25vw" wrapperClassName="absolute inset-0" />
          </div>
          <div className="relative min-h-[260px]">
            <SmartImage src={IMG.runSunset} alt="Runner silhouetted at sunset" sizes="25vw" wrapperClassName="absolute inset-0" />
          </div>
          <div className="col-span-2 flex flex-col justify-center bg-ink p-8 text-white sm:p-12">
            <p className="font-display text-4xl font-extrabold uppercase leading-[0.9] sm:text-5xl">Every sport. Every session.</p>
            <p className="mt-4 max-w-md text-white/70">Football, basketball, running and training — plus the apparel and equipment that ties it all together.</p>
          </div>
        </div>
      </section>

      <section className="container-site py-20 sm:py-28" aria-labelledby="pillars-title">
        <p className="eyebrow">What drives us</p>
        <h2 id="pillars-title" className="heading-xl mt-4 max-w-3xl">
          Six principles. One standard.
        </h2>
        <ul className="mt-14 grid gap-px bg-paper-200 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p, i) => (
            <li key={p.title} className="bg-white">
              <Reveal delay={(i % 3) * 80} className="h-full p-8">
                <span className="font-display text-sm font-semibold text-accent-dark">0{i + 1}</span>
                <h3 className="mt-6 font-display text-3xl font-bold uppercase">{p.title}</h3>
                <p className="mt-3 leading-relaxed text-ink-500">{p.text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-paper-100">
        <div className="container-site grid items-center gap-10 py-20 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Teams, schools & clubs</p>
            <h2 className="heading-lg mt-4">Equip your whole squad</h2>
            <p className="mt-4 max-w-lg text-ink-600">
              We supply sports clubs, schools, gyms and professional teams. Talk to our team about kit, balls and equipment for your organisation.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <ButtonLink to="/contact" variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Contact us
            </ButtonLink>
            <a href={SITE.contact.phoneHref} className="btn btn-outline btn-lg">
              {SITE.contact.phone}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
