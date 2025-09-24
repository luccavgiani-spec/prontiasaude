import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import Index from "./pages/Index";
import QuemSomos from "./pages/QuemSomos";
import Servicos from "./pages/Servicos";
import ServicoDetalhe from "./pages/ServicoDetalhe";
import Planos from "./pages/Planos";
import Empresas from "./pages/Empresas";
import EmpresasDoBem from "./pages/EmpresasDoBem";
import BlogsIndex from "./pages/BlogsIndex";
import BlogArticlePage from "./pages/BlogArticlePage";
import Paciente from "./pages/Paciente";
import Confirmacao from "./pages/Confirmacao";
import NotFound from "./pages/NotFound";
// Auth pages
import Entrar from "./pages/Entrar";
import Cadastrar from "./pages/Cadastrar";
import AuthCallback from "./pages/auth/Callback";
import ResetPassword from "./pages/auth/Reset";
import CompletarPerfil from "./pages/CompletarPerfil";
import Antecedentes from "./pages/intake/Antecedentes";
import AreaDoPaciente from "./pages/AreaDoPaciente";
import Agendamento from "./pages/Agendamento";

const queryClient = new QueryClient();

// Scroll to top component
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/quem-somos" element={<QuemSomos />} />
              <Route path="/servicos" element={<Servicos />} />
              <Route path="/servicos/:slug" element={<ServicoDetalhe />} />
              <Route path="/planos" element={<Planos />} />
              <Route path="/empresas" element={<Empresas />} />
              <Route path="/empresasdobem" element={<EmpresasDoBem />} />
              <Route path="/blogs-artigos" element={<BlogsIndex />} />
              <Route path="/blogs-artigos/:slug" element={<BlogArticlePage />} />
              <Route path="/paciente" element={<Paciente />} />
              <Route path="/confirmacao" element={<Confirmacao />} />
              {/* Auth routes */}
              <Route path="/entrar" element={<Entrar />} />
              <Route path="/cadastrar" element={<Cadastrar />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/reset" element={<ResetPassword />} />
              <Route path="/completar-perfil" element={<CompletarPerfil />} />
              <Route path="/intake/antecedentes" element={<Antecedentes />} />
              <Route path="/agendamento" element={<Agendamento />} />
              <Route path="/area-do-paciente" element={<AreaDoPaciente />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
