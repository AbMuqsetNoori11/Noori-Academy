import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest, registerUnauthorizedHandler, setCsrfToken, setSessionToken } from '../utils/api';
import { registerLanguageChangeListener, useI18n, type LangCode } from '../i18n';

export interface UserSession {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  full_name: string;
  phone: string;
  photo_url: string;
  preferred_lang: LangCode;
  status: 'active' | 'inactive';
  teacher_id?: number | null;
  student_id?: number | null;
}

export interface SystemBranding {
  site_name: string;
  site_logo_url: string;
  currency_symbol: string;
}

interface AuthContextValue {
  user: UserSession | null;
  branding: SystemBranding;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<UserSession>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setBranding: React.Dispatch<React.SetStateAction<SystemBranding>>;
}

const DEFAULT_BRANDING: SystemBranding = {
  site_name: 'Danesh Academy',
  site_logo_url: '',
  currency_symbol: 'AFN',
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [branding, setBranding] = useState<SystemBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const { setLanguage } = useI18n();

  const refreshUser = async () => {
    try {
      const data = await apiRequest<{
        authenticated: boolean;
        user: UserSession | null;
        csrfToken: string | null;
        sessionToken?: string | null;
        defaultLanguage?: LangCode;
        branding?: SystemBranding;
      }>('/api/auth/me');
      if (data.branding) {
        setBranding(data.branding);
      }
      if (data.authenticated && data.user) {
        if (data.sessionToken) setSessionToken(data.sessionToken);
        setCsrfToken(data.csrfToken);
        setUser(data.user);
      } else {
        setSessionToken(null);
        setCsrfToken(null);
        setUser(null);
      }
      if (data.user?.preferred_lang) {
        setLanguage(data.user.preferred_lang, false);
      } else if (!localStorage.getItem('danesh_lang') && data.defaultLanguage) {
        setLanguage(data.defaultLanguage, false);
      }
    } catch {
      setSessionToken(null);
      setUser(null);
      setCsrfToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setSessionToken(null);
      setCsrfToken(null);
      setUser(null);
    });
    registerLanguageChangeListener((code) => {
      setUser((prev) => (prev ? { ...prev, preferred_lang: code } : prev));
    });
    void refreshUser();
    return () => {
      registerUnauthorizedHandler(null);
      registerLanguageChangeListener(null);
    };
  }, []);

  const login = async (identifier: string, password: string): Promise<UserSession> => {
    const data = await apiRequest<{ user: UserSession; csrfToken: string; sessionToken?: string; branding?: SystemBranding }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    if (data.sessionToken) {
      setSessionToken(data.sessionToken);
    }
    if (data.branding) {
      setBranding(data.branding);
    }
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    if (data.user.preferred_lang) {
      setLanguage(data.user.preferred_lang, false);
    }
    return data.user;
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setSessionToken(null);
    setCsrfToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, branding, loading, login, logout, refreshUser, setBranding }}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
