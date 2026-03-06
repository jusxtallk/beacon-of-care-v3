import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "elder" | "family" | "care_staff";

interface ProfileData {
  full_name: string;
  phone: string | null;
  setup_completed: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: ProfileData | null;
  loading: boolean;
  setupCompleted: boolean;
  markSetupComplete: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  profile: null,
  loading: true,
  setupCompleted: false,
  markSetupComplete: async () => {},
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// Helper for retrying promises
const retry = async <T,>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    console.warn(`Retry attempt failed. Retries left: ${retries}. Error:`, error);
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      console.log("useAuth: fetchUserData started for", userId);
      
      const fetchData = async () => {
        const [roleRes, profileRes] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
          supabase.from("profiles").select("full_name, phone, setup_completed").eq("user_id", userId).maybeSingle(),
        ]);
        
        if (roleRes?.error) throw roleRes.error;
        if (profileRes?.error) throw profileRes.error;
        
        return { roleRes, profileRes };
      };

      const fetchPromise = retry(fetchData, 3, 1000);

      const { roleRes, profileRes } = await fetchPromise;

      if (roleRes.data) setRole(roleRes.data.role as AppRole);
      if (profileRes.data) setProfile(profileRes.data);
      console.log("useAuth: fetchUserData success");
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      console.log("useAuth: initializeAuth started");
      try {
        // 1. Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        
        console.log("useAuth: getSession result", session ? "Session found" : "No session");
        
        if (mounted) {
          if (session) {
            setSession(session);
            setUser(session.user);
            await fetchUserData(session.user.id);
          } else {
            setSession(null);
            setUser(null);
            setRole(null);
            setProfile(null);
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        console.log("useAuth: initializeAuth finally, setting loading false");
        if (mounted) {
          setLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    initializeAuth();

    // Safety timeout: force loading to false after 60 seconds if it hangs
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn("Auth initialization timed out, forcing loading to false");
        setLoading(false);
      }
    }, 60000);

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("useAuth: onAuthStateChange", event);
        if (!mounted) return;
        
        // If we are already loading (initial check), let initializeAuth handle it
        // to avoid race conditions. Only handle subsequent updates.
        
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setRole(null);
          setProfile(null);
          setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchUserData(session.user.id);
          }
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const markSetupComplete = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ setup_completed: true }).eq("user_id", user.id);
    setProfile((p) => p ? { ...p, setup_completed: true } : p);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, setup_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setProfile(data);
  };

  const setupCompleted = profile?.setup_completed ?? false;

  const signOut = async () => {
    try {
      console.log("useAuth: signOut started");
      const signOutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Sign out timed out")), 5000)
      );
      
      await Promise.race([signOutPromise, timeoutPromise]);
      console.log("useAuth: signOut success");
    } catch (error) {
      if (error instanceof Error && error.message === "Sign out timed out") {
        console.warn("Sign out timed out, proceeding to clear local state");
      } else {
        console.error("Error signing out from Supabase:", error);
      }
    } finally {
      console.log("useAuth: signOut finally, clearing state");
      // Always clear local state
      setUser(null);
      setSession(null);
      setRole(null);
      setProfile(null);
      setLoading(false); // Ensure loading is false
      
      // Clear any local storage items if needed
      if (typeof localStorage !== "undefined") {
         // Clear Supabase keys
         Object.keys(localStorage).forEach(key => {
           if (key.startsWith('sb-')) localStorage.removeItem(key);
         });
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, setupCompleted, markSetupComplete, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
