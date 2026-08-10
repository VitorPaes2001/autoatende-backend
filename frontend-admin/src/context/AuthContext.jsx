/* __AUTOATENDE_C6B_R2_AUTHCONTEXT_ROLE_BINDING__ */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { resolveCurrentRole } from '../lib/roleAccess';
import { attachIdentityToAcquisitionContext } from '../utils/acquisitionAttribution';

const AuthContext = createContext();

/* __AUTOATENDE_STRIPE_PHASE2R_D5F_B_AUTH_TENANT_CONTEXT__ */
function aaD5fBFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function aaD5fBResolveTenantIdentity(session, user) {
  const currentUser = user || session?.user || null;
  const userMetadata = currentUser?.user_metadata || {};
  const appMetadata = currentUser?.app_metadata || {};

  const companyId = aaD5fBFirstString(
    currentUser?.company_id,
    currentUser?.companyId,
    appMetadata.company_id,
    appMetadata.companyId,
    userMetadata.company_id,
    userMetadata.companyId,
    session?.company_id,
    session?.companyId
  );

  const clientId = aaD5fBFirstString(
    currentUser?.client_id,
    currentUser?.clientId,
    appMetadata.client_id,
    appMetadata.clientId,
    userMetadata.client_id,
    userMetadata.clientId,
    session?.client_id,
    session?.clientId
  );

  const role = aaD5fBFirstString(
    currentUser?.role,
    appMetadata.role,
    userMetadata.role,
    session?.role
  );

  return {
    company_id: companyId || null,
    companyId: companyId || null,
    client_id: clientId || null,
    clientId: clientId || null,
    tenant_company_id: companyId || null,
    tenant_client_id: clientId || null,
    role: role || null,
    email: currentUser?.email || null,
    user_id: currentUser?.id || null,
    userId: currentUser?.id || null,
  };
}

function aaD5fBMaterializeTenantStorage(windowRef, tenantIdentity) {
  if (!windowRef?.localStorage) return;

  const companyId = tenantIdentity?.company_id || '';
  const clientId = tenantIdentity?.client_id || '';

  const setOrRemove = (key, value) => {
    if (value) windowRef.localStorage.setItem(key, value);
    else windowRef.localStorage.removeItem(key);
  };

  setOrRemove('company_id', companyId);
  setOrRemove('companyId', companyId);
  setOrRemove('current_company_id', companyId);
  setOrRemove('currentCompanyId', companyId);

  setOrRemove('client_id', clientId);
  setOrRemove('clientId', clientId);
  setOrRemove('current_client_id', clientId);
  setOrRemove('currentClientId', clientId);

  windowRef.__AUTOATENDE_COMPANY_ID__ = companyId || '';
  windowRef.__AUTOATENDE_CLIENT_ID__ = clientId || '';
}



export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const rawRole =
    user?.role ||
    user?.user_metadata?.role ||
    user?.app_metadata?.role ||
    session?.user?.role ||
    session?.user?.user_metadata?.role ||
    session?.user?.app_metadata?.role ||
    null;

  const resolvedRole = rawRole ? resolveCurrentRole(rawRole) : null;

  useEffect(() => {
    // Check active sessions and subscribe to auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);


  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tenantIdentity = aaD5fBResolveTenantIdentity(session, user);

            const binding = {
      session: session ?? null,
      currentSession: session ?? null,
      user: user ?? null,
      currentUser: user ?? null,
      profile: null,
      role: resolvedRole || tenantIdentity.role,
              company_id: tenantIdentity.company_id,
              companyId: tenantIdentity.companyId,
              client_id: tenantIdentity.client_id,
              clientId: tenantIdentity.clientId,
              tenant_company_id: tenantIdentity.tenant_company_id,
              tenant_client_id: tenantIdentity.tenant_client_id,
              access_token: session?.access_token || null,
    };

    window.__AUTOATENDE_AUTH__ = binding;
    window.__AUTOATENDE_SESSION__ = binding;
    window.__AUTOATENDE_USER__ = binding;

    try {
      window.localStorage.setItem('auth_user', JSON.stringify(binding));
    } catch {}

    try {
      window.localStorage.setItem('autoatende_user', JSON.stringify(binding));
      try {
        attachIdentityToAcquisitionContext(binding);
      } catch (error) {
        console.warn('[R10C-B] acquisition auth bridge failed', error);
      }
    } catch {}
  try {
              aaD5fBMaterializeTenantStorage(window, tenantIdentity);
            } catch {}

          }, [session, user, resolvedRole]);

  const value = {
      session,
      user,
      rawRole,
      resolvedRole,
      signOut: () => supabase.auth.signOut(),
    };

    /* __AUTOATENDE_C16M_B1_R3_AGENTS_FRONTEND_HARDENING__ */

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
