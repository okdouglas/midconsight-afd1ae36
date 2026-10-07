import { Hero } from '@/components/landing/Hero';
import { SkipLink, SiteNav, SiteFooter } from '@/components/landing/Chrome';
import { WeekStart, VoiceCount, SayItPlain } from '@/components/landing/VoiceSections';
import {
  ScoredLeads,
  MapSection,
  DataSection,
  CompaniesDeals,
  ResearchExport,
  MondayImport,
} from '@/components/landing/ProductSections';
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
        <MapSection />
        <DataSection />
        <CompaniesDeals />
        <ResearchExport />
        <MondayImport />
        <VoiceCount />
        <SayItPlain />
        <Pricing />
        <Faq />
        <ClosingCta />
        <Newsletter />
      </main>
      <SiteFooter />
    </div>
  );
}
