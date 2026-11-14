import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { profileApi } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadProfile = useCallback(async (activeSession) => {
    try {
      const p = await profileApi.get();
      if (p) {
        setProfile(p);
        return p;
      }
    } catch (_err) {
      // Fallback: if profile row doesn't exist yet, auto-create from user metadata
      const user = activeSession?.user;
      if (user) {
        const meta = user.user_metadata || {};
        const fallbackPayload = {
          id: user.id,
          full_name: meta.full_name || user.email?.split('@')[0] || 'EzRemedy User',
          role: meta.role || 'patient',
          phone: meta.phone || null,
          specialization: meta.role === 'doctor' ? meta.specialization || 'General Physician' : null
        };
        const { data: created } = await supabase
          .from('profiles')
          .upsert(fallbackPayload, { onConflict: 'id' })
          .select()
          .single();
        if (created) {
          setProfile(created);
          return created;
        }
      }
      setProfile(null);
    }
    return null;
  }, []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      if (data.session) {
        await loadProfile(data.session);
      }
      if (isMounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession);
      } else {
        setProfile(null);
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = async ({ email, password, fullName, role, phone, specialization }) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role || 'patient',
          phone: phone || null,
          specialization: role === 'doctor' ? specialization || 'General Physician' : null
        }
      }
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          full_name: fullName,
          role: role || 'patient',
          phone: phone || null,
          specialization: role === 'doctor' ? specialization || 'General Physician' : null
        },
        { onConflict: 'id' }
      );
      if (profileError) {
        console.warn('Profile upsert deferred:', profileError.message);
      }
    }

    if (data.session) {
      await loadProfile(data.session);
    }

    return data;
  };

  const signIn = async ({ email, password }) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    await loadProfile(data.session);
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  const value = {
    session,
    profile,
    loading,
    authError,
    isAuthenticated: Boolean(session),
    role: profile ? profile.role : null,
    signUp,
    signIn,
    signOut,
    refreshProfile: () => loadProfile(session)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
