import { useState, useEffect, useCallback } from "react";
import { User, UserRole } from "../types";
import { supabase, checkSupabaseConnection } from "../lib/supabase";

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<"loading" | "ok" | "error" | "warning">("loading");

  const syncUserProfile = useCallback(async (sbUser: any) => {
    try {
      const metaRole = sbUser.user_metadata?.role;
      let initialRole = UserRole.TECHNICIAN;

      if (metaRole && String(metaRole).trim().toUpperCase() === "MANAGER") {
        initialRole = UserRole.MANAGER;
      }

      const defaultUser: User = {
        id: sbUser.id,
        email: sbUser.email || "",
        firstName: sbUser.user_metadata?.firstName || sbUser.email?.split("@")[0] || "Utilisateur",
        lastName: "",
        role: initialRole,
        avatarUrl: `https://ui-avatars.com/api/?name=${sbUser.email}&background=4f46e5&color=fff`,
        position: initialRole === UserRole.MANAGER ? "Manager IT" : "Technicien Support",
        level: 1,
        currentXp: 0,
        nextLevelXp: 1000,
        badges: [],
      };
      setUser(defaultUser);

      const fetchProfilePromise = supabase
        .from("user_profiles")
        .select("*")
        .eq("id", sbUser.id)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("DB_TIMEOUT")), 10000)
      );

      let profile: any = null;
      try {
        const result: any = await Promise.race([fetchProfilePromise, timeoutPromise]);
        profile = result.data;
      } catch (err: any) {
        console.warn("Profile fetch error or timeout:", err.message);
      }

      if (profile) {
        let finalRole = initialRole;
        const dbRole = profile?.role;

        if (dbRole) {
          const normalizedRole = String(dbRole).trim().toLowerCase();
          if (normalizedRole === "manager") {
            finalRole = UserRole.MANAGER;
          } else if (normalizedRole === "technicien" || normalizedRole === "technician") {
            finalRole = UserRole.TECHNICIAN;
          }
        }

        setUser((prev) =>
          prev
            ? {
                ...prev,
                firstName: profile.first_name || prev.firstName,
                lastName: profile.last_name || "",
                role: finalRole,
                avatarUrl: profile.avatar_url || prev.avatarUrl,
                position: finalRole === UserRole.MANAGER ? "Manager IT" : "Technicien Support",
              }
            : null
        );
      }
    } catch (err) {
      console.error("Critical error in syncUserProfile:", err);
    }
  }, []);

  useEffect(() => {
    const initApp = async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout d'initialisation")), 10000)
      );

      try {
        await Promise.race([
          (async () => {
            checkSupabaseConnection().then((diag) => {
              setConnectionStatus(diag.status as any);
            });

            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              setIsAuthenticated(true);
              await syncUserProfile(session.user);
            }
          })(),
          timeoutPromise,
        ]);
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        await syncUserProfile(session.user);
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        setIsAuthenticated(false);
        setUser(null);
        setLoading(false);
      } else if (event === "INITIAL_SESSION") {
        if (!session) setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [syncUserProfile]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Logout Timeout")), 2000)),
      ]);
    } catch (error) {
      console.warn("Logout timeout or error, forcing local cleanup:", error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      setIsAuthenticated(false);
      setUser(null);
      setLoading(false);
      window.location.hash = "";
    }
  };

  return { isAuthenticated, user, loading, connectionStatus, handleLogout };
};
