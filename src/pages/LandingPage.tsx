import { useEffect } from "react";
import LPHeader from "@/components/lp/LPHeader";
import LPHeroSection from "@/components/lp/LPHeroSection";
import LPPriceBanner from "@/components/lp/LPPriceBanner";
import LPTelemedicineSection from "@/components/lp/LPTelemedicineSection";
import LPHowItWorks from "@/components/lp/LPHowItWorks";
import LPStatsSection from "@/components/lp/LPStatsSection";
import LPMedicalCertificateSection from "@/components/lp/LPMedicalCertificateSection";
import LPTestimonialsSection from "@/components/lp/LPTestimonialsSection";
import LPFAQSection from "@/components/lp/LPFAQSection";
import LPFooter from "@/components/lp/LPFooter";
import LPDoctorNotification from "@/components/lp/LPDoctorNotification";

const LandingPage = () => {
  // Track page view for analytics
  useEffect(() => {
    // Meta Pixel PageView is already tracked by the global hook
    // Additional LP-specific tracking can be added here
    document.title = "Médico Online 24h - Consulta R$39,90 | Prontia Saúde";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <LPHeader />
      <LPDoctorNotification />
      <main>
        <LPHeroSection />
        <LPPriceBanner />
        <LPTelemedicineSection />
        <LPHowItWorks />
        <LPStatsSection />
        <LPMedicalCertificateSection />
        <LPTestimonialsSection />
        <LPFAQSection />
      </main>
      <LPFooter />
    </div>
  );
};

export default LandingPage;
