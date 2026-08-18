import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();
const STORAGE_KEY = 'nh_local_user';

// Codificação simples para não exibir a senha em texto puro na entidade
export const encodeSenha = (senha) => {
  try { return btoa(unescape(encodeURIComponent(senha))); }
  catch { return senha; }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Verifica sessão local salva no navegador
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const u = JSON.parse(stored);
        setUser(u);
        setIsAuthenticated(true);
      }
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoadingAuth(false);
    setAuthChecked(true);
  }, []);

  const login = async (usuario, senha) => {
    const encoded = encodeSenha(senha);
    const matches = await base44.entities.UsuarioLocal.filter({
      usuario,
      senha: encoded,
      ativo: true,
    });
    if (!matches || matches.length === 0) {
      throw new Error('Usuário ou senha incorretos');
    }
    const u = matches[0];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    setIsAuthenticated(true);
    return u;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const checkUserAuth = () => {
    setAuthChecked(true);
    setIsLoadingAuth(false);
  };

  const checkAppState = () => {
    setIsLoadingPublicSettings(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      authChecked,
      login,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};