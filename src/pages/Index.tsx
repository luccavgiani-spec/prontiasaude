import { HeroSection } from "@/components/home/HeroSection";
import { BenefitsBar } from "@/components/home/BenefitsBar";
import { ServicosSection } from "@/components/home/ServicosSection";
import ComoFuncionaStepper from "@/sections/ComoFuncionaStepper";
import { PlanosSection } from "@/components/home/PlanosSection";
import { FAQSection } from "@/components/home/FAQSection";
import { ProvasSection } from "@/components/home/ProvasSection";
import { ClubeBenBannerSection } from "@/components/home/ClubeBenBannerSection";
const Index = () => {
  return <>
      <HeroSection />
      <BenefitsBar />
      <ServicosSection />
      <ComoFuncionaStepper />
      <PlanosSection />
      <ClubeBenBannerSection />
      <FAQSection />
      
    </>;
};
export default Index;