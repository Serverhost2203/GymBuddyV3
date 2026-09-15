import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, TOKEN_KEY } from "@/src/api";
import { dictionaries, type Dict, type Lang } from "@/src/i18n";
import { loadThemePref } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  root_admin: boolean;
  onboarded: boolean;
  gender?: string | null;
  date_of_birth?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  target_weight_kg?: number | null;
  goal?: string | null;
  experience?: string | null;
  training_days: string[];
  workout_duration_min: number;
  equipment: string[];
  units: string;
  language: Lang;
  avatar?: string | null;
  notifications: Record<string, boolean>;
  privacy: Record<string, boolean>;
  leaderboard_optin: boolean;
  subscription: string;
  xp: number;
  level: number;
  streak: number;
  best_streak: number;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  lang: Lang;
  t: Dict;
  isPremium: boolean;
  setLang: (l: Lang) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
};

const AppContext = createContext<Ctx>(null as any);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Lang>("en");

  const applyUser = useCallback((u: User | null) => {
    setUser(u);
    if (u?.language && dictionaries[u.language]) setLangState(u.language);
  }, []);

  const bootstrap = useCallback(async () => {
    await loadThemePref();
    const savedLang = await storage.getItem<Lang>("gb_lang", "en");
    if (savedLang && dictionaries[savedLang]) setLangState(savedLang);
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (token) {
      try {
        const me = await api.get<User>("/auth/me");
        applyUser(me);
      } catch {
        await storage.secureRemove(TOKEN_KEY);
      }
    }
    setLoading(false);
  }, [applyUser]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/login", { email, password }, false);
    await storage.secureSet(TOKEN_KEY, res.token);
    applyUser(res.user);
  }, [applyUser]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/register", { name, email, password }, false);
    await storage.secureSet(TOKEN_KEY, res.token);
    applyUser(res.user);
  }, [applyUser]);

  const resetPassword = useCallback(async (email: string, code: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/reset-password", { email, code, password }, false);
    await storage.secureSet(TOKEN_KEY, res.token);
    applyUser(res.user);
  }, [applyUser]);

  const logout = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<User>("/auth/me");
      applyUser(me);
    } catch {
      /* ignore */
    }
  }, [applyUser]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.setItem("gb_lang", l);
    if (user) api.put("/users/me", { language: l }).catch(() => {});
  }, [user]);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    if (patch.language && dictionaries[patch.language]) setLangState(patch.language);
  }, []);

  return (
    <AppContext.Provider
      value={{
        user, loading, lang, t: dictionaries[lang], isPremium: user?.subscription === "premium",
        setLang, login, register, logout, refresh, updateUser,
        resetPassword,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
