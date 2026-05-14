import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Patch global window.fetch (one-time, client-only) pour injecter le bearer
// Supabase courant UNIQUEMENT sur les appels TanStack Server Functions
// (`/_serverFn/*`) protégés par `requireSupabaseAuth`. Aucun autre endpoint
// (Supabase REST, assets, API externes) n'est impacté. Aucun token loggé.
// TanStack Start ne fournit pas (encore) de hook officiel côté client pour
// centraliser les headers ServerFn ; ce patch est la voie la plus sûre et
// la plus restreinte. Idempotent grâce au flag interne `__pcFetchPatched`.
if (typeof window !== "undefined" && !(window as unknown as { __pcFetchPatched?: boolean }).__pcFetchPatched) {
  (window as unknown as { __pcFetchPatched?: boolean }).__pcFetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      if (url && url.includes("/_serverFn/")) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const headers = new Headers(
            init?.headers ??
              (input instanceof Request ? input.headers : undefined),
          );
          if (!headers.has("authorization")) {
            headers.set("authorization", `Bearer ${token}`);
          }
          return originalFetch(input, { ...(init ?? {}), headers });
        }
      }
    } catch {
      // fall through to plain fetch
    }
    return originalFetch(input, init);
  };
}

export type AccountStatus =
  | "pending_verification"
  | "active"
  | "suspended"
  | "deletion_requested";

export interface AppUserProfile {
  user_id: string;
  display_name: string;
  preferred_language: string;
  bio: string | null;
  avatar_url: string | null;
}

export interface AppUserRecord {
  id: string;
  email: string;
  account_status: AccountStatus;
  email_verified_at: string | null;
  deleted_at: string | null;
}

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  appUser: AppUserRecord | null;
  profile: AppUserProfile | null;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUserRecord | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAppData = async (uid: string) => {
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase
        .from("users")
        .select("id, email, account_status, email_verified_at, deleted_at")
        .eq("id", uid)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("user_id, display_name, preferred_language, bio, avatar_url")
        .eq("user_id", uid)
        .maybeSingle(),
    ]);
    setAppUser((u as AppUserRecord) ?? null);
    setProfile((p as AppUserProfile) ?? null);
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) {
      await loadAppData(data.session.user.id);
    } else {
      setAppUser(null);
      setProfile(null);
    }
  };

  useEffect(() => {
    // Set up listener BEFORE getSession (per Supabase guidance)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // defer DB call to avoid potential deadlocks inside the listener
        setTimeout(() => {
          void loadAppData(s.user.id);
        }, 0);
      } else {
        setAppUser(null);
        setProfile(null);
      }
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session?.user) {
        await loadAppData(data.session.user.id);
      }
      setLoading(false);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAppUser(null);
    setProfile(null);
  };

  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    appUser,
    profile,
    isAuthenticated: !!session?.user,
    isEmailVerified: !!appUser?.email_verified_at,
    refresh,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
