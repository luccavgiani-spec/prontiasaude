import { HeroSection } from "@/components/home/HeroSection";
import { BenefitsBar } from "@/components/home/BenefitsBar";
import { ServicosSection } from "@/components/home/ServicosSection";
import ComoFuncionaStepper from "@/sections/ComoFuncionaStepper";
import { PlanosSection } from "@/components/home/PlanosSection";
import { ProvasSection } from "@/components/home/ProvasSection";

const Index = () => {
  return (
    <>
      <HeroSection />
      <BenefitsBar />
      <ServicosSection />
      <ComoFuncionaStepper />
      <PlanosSection />
      <ProvasSection />
    </>
  );
};

export default Index;
