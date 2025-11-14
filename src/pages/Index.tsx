import { lazy, Suspense } from 'react';
import { HeroSection } from "@/components/home/HeroSection";
import { BenefitsBar } from "@/components/home/BenefitsBar";
import { ServicosSection } from "@/components/home/ServicosSection";
import ComoFuncionaStepper from "@/sections/ComoFuncionaStepper";

// Lazy load non-critical sections
const PlanosSection = lazy(() => import("@/components/home/PlanosSection").then(m => ({ default: m.PlanosSection })));
const ClubeBenBannerSection = lazy(() => import("@/components/home/ClubeBenBannerSection").then(m => ({ default: m.ClubeBenBannerSection })));
const FAQSection = lazy(() => import("@/components/home/FAQSection").then(m => ({ default: m.FAQSection })));

const Index = () => {
  return <>
      <HeroSection />
      <BenefitsBar />
      <ServicosSection />
      <ComoFuncionaStepper />
      <Suspense fallback={<div style={{ minHeight: '400px' }} />}>
        <PlanosSection />
      </Suspense>
      <Suspense fallback={<div style={{ minHeight: '300px' }} />}>
        <ClubeBenBannerSection />
      </Suspense>
      <Suspense fallback={<div style={{ minHeight: '600px' }} />}>
        <FAQSection />
      </Suspense>
    </>;
};

export default Index;