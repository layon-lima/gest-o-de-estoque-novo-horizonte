import React, {
  createContext,
  useState,
  useContext,
  useEffect,
} from 'react';

import { api } from '@/api/apiClient';
import { prefetchEntidades } from '@/lib/useEntidades';


const AuthContext = createContext();


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] =
    useState(false);

  const [isLoadingAuth, setIsLoadingAuth] =
    useState(true);

  const [
    isLoadingPublicSettings,
    setIsLoadingPublicSettings,
  ] = useState(true);

  const [authError, setAuthError] =
    useState(null);

  const [authChecked, setAuthChecked] =
    useState(false);


  const checkUserAuth = async () => {
    setAuthError(null);

    try {
      const authenticated =
        await api.auth.isAuthenticated();

      if (authenticated) {
        const currentUser =
          await api.auth.me();

        setUser(currentUser);
        setIsAuthenticated(true);

        prefetchEntidades(currentUser);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };


  useEffect(() => {
    (async () => {
      setIsLoadingPublicSettings(true);

      await checkUserAuth();

      setIsLoadingPublicSettings(false);
    })();
  }, []);


  const navigateToLogin = () => {
    if (
      window.location.pathname !== '/login'
    ) {
      window.location.href = '/login';
    }
  };


  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);

    api.auth.logout();
  };


  const checkAppState = () => {
    setIsLoadingPublicSettings(false);
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        authChecked,
        checkUserAuth,
        checkAppState,
        navigateToLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return ctx;
};
