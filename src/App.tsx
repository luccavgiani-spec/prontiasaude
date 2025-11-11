import React, { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useMetaTracking } from "@/hooks/use-meta-tracking";
import { initMetaTracking } from "@/lib/meta-tracking";
import { initWebVitals } from "@/lib/web-vitals";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import WhatsAppFloatButton from "@/components/layout/WhatsAppFloatButton";

// Critical Pages (loaded immediately)
import Index from "./pages/Index";
import Servicos from "./pages/Servicos";
import NotFound from "./pages/NotFound";

// Intercepta respostas 402 do schedule-redirect e abre o modal de pagamento
if (typeof window !== "undefined" && !(window as any).__schedule402Patched) {
  (window as any).__schedule402Patched = true;

  const _fetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await _fetch(input, init);

    try {
      const url = typeof input === "string" ? input : (input as Request).url;
      const isSchedule = typeof url === "string" && url.includes("/functions/v1/schedule-redirect");

      if (isSchedule && res.status === 402) {
        const data = await res
          .clone()
          .json()
          .catch(() => null);
        if (data?.require_payment) {
          let sku: string | undefined;
          try {
            const bodyStr =
              typeof init?.body === "string" ? (init.body as string) : undefined;
            sku = bodyStr ? JSON.parse(bodyStr)?.sku : undefined;
          } catch {}

          // ⬇️ NOVO BLOCO: tenta abrir o modal imediatamente, ou guarda para abrir depois
          if ((window as any).__openPaymentModal) {
            (window as any).__openPaymentModal(sku);
          } else {
            console.warn("[patch] PaymentModal ainda não montou. Guardando requisição...");
            (window as any).__paymentModalQueue = sku || true;
          }
        }
      }
    } catch (err) {
      console.error('[schedule-redirect-patch] Error:', err);
    }

    return res;
  };
}

// Lazy-loaded Pages (code splitting)
const QuemSomos = lazy(() => import("./pages/QuemSomos"));
const ServicoDetalhe = lazy(() => import("./pages/ServicoDetalhe"));
const Consulta = lazy(() => import("./pages/servicos/Consulta"));
const Psicologa = lazy(() => import("./pages/servicos/Psicologa"));
const MedicosEspecialistas = lazy(() => import("./pages/servicos/MedicosEspecialistas"));
const LaudosPsicologicos = lazy(() => import("./pages/servicos/LaudosPsicologicos"));
const RenovacaoReceitas = lazy(() => import("./pages/servicos/RenovacaoReceitas"));
const SolicitacaoExames = lazy(() => import("./pages/servicos/SolicitacaoExames"));
const Planos = lazy(() => import("./pages/Planos"));
const Empresas = lazy(() => import("./pages/Empresas"));
const EmpresasDoBem = lazy(() => import("./pages/EmpresasDoBem"));
const BlogsIndex = lazy(() => import("./pages/BlogsIndex"));
const BlogArticlePage = lazy(() => import("./pages/BlogArticlePage"));
const Paciente = lazy(() => import("./pages/Paciente"));
const Entrar = lazy(() => import("./pages/Entrar"));
const Cadastrar = lazy(() => import("./pages/Cadastrar"));
const EsqueciSenha = lazy(() => import("./pages/EsqueciSenha"));
const AuthCallback = lazy(() => import("./pages/auth/Callback"));
const ResetPassword = lazy(() => import("./pages/auth/Reset"));
const NovaSenha = lazy(() => import("./pages/NovaSenha"));
const CompletarPerfil = lazy(() => import("./pages/CompletarPerfil"));
const Antecedentes = lazy(() => import("./pages/intake/Antecedentes"));
const AreaDoPaciente = lazy(() => import("./pages/AreaDoPaciente"));
const Agendamento = lazy(() => import("./pages/Agendamento"));
const ConfirmacaoExame = lazy(() => import("./pages/ConfirmacaoExame"));
const SaudeMental = lazy(() => import("./pages/SaudeMental"));
const Livros = lazy(() => import("./pages/Livros"));
const Playlists = lazy(() => import("./pages/Playlists"));
const ReceitasSaudaveis = lazy(() => import("./pages/ReceitasSaudaveis"));
const TrabalheConosco = lazy(() => import("./pages/TrabalheConosco"));
const SejaNossParceiro = lazy(() => import("./pages/SejaNossParceiro"));
const DisqueDenuncia = lazy(() => import("./pages/DisqueDenuncia"));
const Termos = lazy(() => import("./pages/Termos"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const EmpresaLogin = lazy(() => import("./pages/empresa/Login"));
const EmpresaDashboard = lazy(() => import("./pages/empresa/Dashboard"));
const EmpresaPerfil = lazy(() => import("./pages/empresa/Perfil"));
const EmpresaSeguranca = lazy(() => import("./pages/empresa/Seguranca"));
const EmpresaTrocarSenha = lazy(() => import("./pages/empresa/TrocarSenha"));
const EmpresaFuncionarios = lazy(() => import("./pages/empresa/Funcionarios"));
const ClubeBen = lazy(() => import("./pages/ClubeBen"));
const ClubeBenAuth = lazy(() => import("./pages/ClubeBenAuth"));
const ClickLifeSSO = lazy(() => import("./pages/ClickLifeSSO"));

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

// Initialize Meta tracking and Web Vitals once
if (typeof window !== "undefined") {
  initMetaTracking();
  initWebVitals();
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col bg-muted/30">
          <Navbar />
          <main className="flex-1">
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/quem-somos" element={<QuemSomos />} />
                <Route path="/servicos" element={<Servicos />} />
                <Route path="/servicos/consulta" element={<Consulta />} />
                <Route path="/servicos/psicologa" element={<Psicologa />} />
                <Route path="/servicos/medicos_especialistas" element={<MedicosEspecialistas />} />
                <Route path="/servicos/laudos_psicologicos" element={<LaudosPsicologicos />} />
                <Route path="/servicos/renovacao_receitas" element={<RenovacaoReceitas />} />
                <Route path="/servicos/solicitacao_exames" element={<SolicitacaoExames />} />
                <Route path="/servicos/:slug" element={<ServicoDetalhe />} />
                <Route path="/planos" element={<Planos />} />
                <Route path="/empresas" element={<Empresas />} />
                <Route path="/empresasdobem" element={<EmpresasDoBem />} />
                <Route path="/blogs-artigos" element={<BlogsIndex />} />
                <Route path="/blogs-artigos/:slug" element={<BlogArticlePage />} />
                <Route path="/paciente" element={<Paciente />} />
                <Route path="/solicitacao_exame" element={<ConfirmacaoExame />} />

                {/* Auth routes */}
                <Route path="/entrar" element={<Entrar />} />
                <Route path="/cadastrar" element={<Cadastrar />} />
                <Route path="/esqueci-senha" element={<EsqueciSenha />} />
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

                {/* ClubeBen routes */}
                <Route path="/clubeben" element={<ClubeBen />} />
                <Route path="/auth" element={<ClubeBenAuth />} />
                
                {/* SSO route */}
                <Route path="/sso" element={<ClickLifeSSO />} />

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
            </Suspense>
          </main>
          <Footer />
        </div>
        <WhatsAppFloatButton />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
