import { lazy, Suspense } from 'react';
import { HeroSection } from "@/components/home/HeroSection";
import ComoFuncionaStepper from "@/sections/ComoFuncionaStepper";

// Lazy load ALL non-critical sections for optimal bundle size
const BenefitsBar = lazy(() => import("@/components/home/BenefitsBar").then(m => ({ default: m.BenefitsBar })));
const ServicosSection = lazy(() => import("@/components/home/ServicosSection").then(m => ({ default: m.ServicosSection })));
const PlanosSection = lazy(() => import("@/components/home/PlanosSection").then(m => ({ default: m.PlanosSection })));
const ClubeBenBannerSection = lazy(() => import("@/components/home/ClubeBenBannerSection").then(m => ({ default: m.ClubeBenBannerSection })));
const FAQSection = lazy(() => import("@/components/home/FAQSection").then(m => ({ default: m.FAQSection })));

const Index = () => {
  return <>
      <HeroSection />
      <Suspense fallback={<div style={{ minHeight: '88px' }} />}>
        <BenefitsBar />
      </Suspense>
      <Suspense fallback={<div style={{ minHeight: '600px' }} />}>
        <ServicosSection />
      </Suspense>
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