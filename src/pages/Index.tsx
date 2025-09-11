import { HeroSection } from "@/components/home/HeroSection";
import { BenefitsBar } from "@/components/home/BenefitsBar";
import { ServicosSection } from "@/components/home/ServicosSection";
import { ComoFunciona } from "@/components/home/ComoFunciona";
import { PlanosSection } from "@/components/home/PlanosSection";
import { ProvasSection } from "@/components/home/ProvasSection";

const Index = () => {
  return (
    <>
      <HeroSection />
      <BenefitsBar />
      <ServicosSection />
      <ComoFunciona />
      <PlanosSection />
      <ProvasSection />
    </>
  );
};

export default Index;
