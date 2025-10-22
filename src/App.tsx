import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useMetaTracking } from "@/hooks/use-meta-tracking";
import { initMetaTracking } from "@/lib/meta-tracking";
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
import NotFound from "./pages/NotFound";
// Auth pages
import Entrar from "./pages/Entrar";
import Cadastrar from "./pages/Cadastrar";
import AuthCallback from "./pages/auth/Callback";
import ResetPassword from "./pages/auth/Reset";
import NovaSenha from "./pages/NovaSenha";
import CompletarPerfil from "./pages/CompletarPerfil";
import Antecedentes from "./pages/intake/Antecedentes";
import AreaDoPaciente from "./pages/AreaDoPaciente";
import Agendamento from "./pages/Agendamento";
import Confirmacao from "./pages/Confirmacao";
import ConfirmacaoReceitas from "./pages/ConfirmacaoReceitas";
import ConfirmacaoExame from "./pages/ConfirmacaoExame";

// New wellness pages
import SaudeMental from "./pages/SaudeMental";
import Livros from "./pages/Livros";
import Playlists from "./pages/Playlists";
import ReceitasSaudaveis from "./pages/ReceitasSaudaveis";

// Footer pages
import TrabalheConosco from "./pages/TrabalheConosco";
import SejaNossParceiro from "./pages/SejaNossParceiro";
import DisqueDenuncia from "./pages/DisqueDenuncia";
import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";
// Admin pages
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
// Empresa pages
import EmpresaLogin from "./pages/empresa/Login";
import EmpresaDashboard from "./pages/empresa/Dashboard";
import EmpresaPerfil from "./pages/empresa/Perfil";
import EmpresaSeguranca from "./pages/empresa/Seguranca";
import EmpresaTrocarSenha from "./pages/empresa/TrocarSenha";
import EmpresaFuncionarios from "./pages/empresa/Funcionarios";

const queryClient = new QueryClient();

// Scroll to top component and track page views
const ScrollToTop = () => {
  const { pathname } = useLocation();
  
  // Track page views on route changes
  useMetaTracking();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

// Initialize Meta tracking once
if (typeof window !== 'undefined') {
  initMetaTracking();
}

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
              <Route path="/confirmacao/:sku" element={<Confirmacao />} />
              <Route path="/confirmacao_receitas" element={<ConfirmacaoReceitas />} />
              <Route path="/solicitacao_exame" element={<ConfirmacaoExame />} />
              
              {/* Auth routes */}
              <Route path="/entrar" element={<Entrar />} />
              <Route path="/cadastrar" element={<Cadastrar />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/reset" element={<ResetPassword />} />
              <Route path="/nova-senha" element={<NovaSenha />} />
              <Route path="/completar-perfil" element={<CompletarPerfil />} />
              <Route path="/intake/antecedentes" element={<Antecedentes />} />
              <Route path="/agendamento" element={<Agendamento />} />
              <Route path="/area-do-paciente" element={<AreaDoPaciente />} />
              {/* Wellness pages */}
              <Route path="/saude-mental" element={<SaudeMental />} />
              <Route path="/livros" element={<Livros />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/receitas-saudaveis" element={<ReceitasSaudaveis />} />
              
              {/* Footer pages */}
              <Route path="/trabalhe-conosco" element={<TrabalheConosco />} />
              <Route path="/seja-nosso-parceiro" element={<SejaNossParceiro />} />
              <Route path="/disque-denuncia" element={<DisqueDenuncia />} />
              <Route path="/termos" element={<Termos />} />
              <Route path="/privacidade" element={<Privacidade />} />
              {/* Admin routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              {/* Empresa routes */}
              <Route path="/empresa/login" element={<EmpresaLogin />} />
              <Route path="/empresa" element={<EmpresaDashboard />} />
              <Route path="/empresa/perfil" element={<EmpresaPerfil />} />
              <Route path="/empresa/seguranca" element={<EmpresaSeguranca />} />
              <Route path="/empresa/trocar-senha" element={<EmpresaTrocarSenha />} />
              <Route path="/empresa/funcionarios" element={<EmpresaFuncionarios />} />
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
