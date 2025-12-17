import PAHeader from "@/components/pronto-atendimento/PAHeader";
import PAHeroSection from "@/components/pronto-atendimento/PAHeroSection";
import PAPriceBanner from "@/components/pronto-atendimento/PAPriceBanner";
import PATelemedicineSection from "@/components/pronto-atendimento/PATelemedicineSection";
import PAHowItWorks from "@/components/pronto-atendimento/PAHowItWorks";
import PAMedicalCertificateSection from "@/components/pronto-atendimento/PAMedicalCertificateSection";
import PAStatsSection from "@/components/pronto-atendimento/PAStatsSection";
import PATestimonialsSection from "@/components/pronto-atendimento/PATestimonialsSection";
import PAFAQSection from "@/components/pronto-atendimento/PAFAQSection";
import PAFooter from "@/components/pronto-atendimento/PAFooter";
import PADoctorNotification from "@/components/pronto-atendimento/PADoctorNotification";

const ProntoAtendimento = () => {
  return (
    <div className="min-h-screen bg-background">
      <PAHeader />
      <PADoctorNotification />
      <main>
        <PAHeroSection />
        <PAPriceBanner />
        <PATelemedicineSection />
        <PAHowItWorks />
        <PAStatsSection />
        <PAMedicalCertificateSection />
        <PATestimonialsSection />
        <PAFAQSection />
      </main>
      <PAFooter />
    </div>
  );
};

export default ProntoAtendimento;
