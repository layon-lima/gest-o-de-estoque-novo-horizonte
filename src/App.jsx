import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from 'next-themes'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { useUppercaseInputs } from '@/hooks/useUppercaseInputs';
// Add page imports here
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import SetorDetail from '@/pages/SetorDetail';
import Cadastros from '@/pages/Cadastros';
import Movimentacoes from '@/pages/Movimentacoes';
import Abastecimento from '@/pages/Abastecimento';
import Pesagem from '@/pages/Pesagem';
import Relatorios from '@/pages/Relatorios';
import Inventario from '@/pages/Inventario';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/setor/:setorId" element={<SetorDetail />} />
        <Route path="/cadastros" element={<Cadastros />} />
        <Route path="/movimentacoes" element={<Movimentacoes />} />
        <Route path="/abastecimento" element={<Abastecimento />} />
        <Route path="/pesagem" element={<Pesagem />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/inventario" element={<Inventario />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  useUppercaseInputs();

  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App