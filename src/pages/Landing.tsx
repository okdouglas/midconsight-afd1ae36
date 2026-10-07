import { Hero } from '@/components/landing/Hero';
import { SkipLink, SiteNav, SiteFooter } from '@/components/landing/Chrome';
import { WeekStart } from '@/components/landing/VoiceSections';
import {
  ScoredLeads,
  CompaniesDeals,
  ResearchExport,
} from '@/components/landing/ProductSections';
import { ScoringLogic } from '@/components/landing/Scoring';
import { Pricing, Faq, ClosingCta, Newsletter } from '@/components/landing/Commerce';
import '@/components/landing/landing.css';

/**
 * Landing page. Section order follows the SEO brief's H2 outline.
 * Copy and numbers live in components/landing/content.ts.
 */
export default function Landing() {
  return (
    <div className="lp min-h-screen bg-white">
      <SkipLink />
      <SiteNav />
      <main id="main">
        <Hero />
        <WeekStart />
        <ScoredLeads />
        <ScoringLogic />
        <CompaniesDeals />
        <ResearchExport />
        <Pricing />
        <Faq />
        <ClosingCta />
        <Newsletter />
      </main>
      <SiteFooter />
    </div>
  );
}
