/**
 * EduChat Session Manager - Isolamento Estrito de Sessão por Máquina e Usuário
 * Previne vazamento de sessões, cruzamento de identidades (ex: Vitória como Gislaine)
 * e garante que tokens de sessões anteriores não contaminem novos acessos.
 */

export const getSavedUserId = () => {
  try {
    return localStorage.getItem('educhat_user_id') || null;
  } catch {
    return null;
  }
};

export const setIsolatedUserSession = (user) => {
  if (!user || !user.id) return;
  try {
    localStorage.setItem('educhat_user_id', user.id);
    if (user.email) {
      localStorage.setItem('educhat_user_email', user.email.toLowerCase());
    }
    const sessionPayload = {
      userId: user.id,
      name: user.name,
      email: user.email || '',
      department: user.department || 'Geral',
      role: user.role || 'Colaborador',
      authenticatedAt: new Date().toISOString()
    };
    localStorage.setItem(`educhat_isolated_session_${user.id}`, JSON.stringify(sessionPayload));
  } catch (err) {
    console.warn('[SessionManager] Erro ao persistir sessão isolada:', err);
  }
};

export const clearAllAuthCaches = async (supabase = null) => {
  try {
    if (supabase?.auth) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }
  } catch {}

  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('sb-') ||
          key.startsWith('supabase.') ||
          key.startsWith('educhat_user') ||
          key.startsWith('educhat_active_') ||
          key.startsWith('educhat_isolated_session_') ||
          key === 'user' ||
          key === 'session')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
  } catch (err) {
    console.warn('[SessionManager] Erro ao limpar cache de storage:', err);
  }
};

/**
 * Valida a sessão ativa do Supabase contra o usuário ativo do React.
 * Se houver descompasso (ex: Supabase logado com Gislaine, mas usuário selecionado é Vitória),
 * a sessão residual do Supabase é IMEDIATAMENTE expurgada do localStorage para evitar contaminação.
 */
export const validateAndEvictMismatchedAuth = async (supabase, activeUser) => {
  if (!supabase?.auth || !activeUser) return null;

  try {
    const { data: authData } = await supabase.auth.getSession();
    const sessionUser = authData?.session?.user;
    if (!sessionUser) return null;

    const activeEmail = (activeUser.email || '').toLowerCase().trim();
    const sessionEmail = (sessionUser.email || '').toLowerCase().trim();
    const activeId = String(activeUser.id || '').trim();
    const sessionId = String(sessionUser.id || '').trim();

    const isMatch =
      sessionId === activeId ||
      (activeEmail && sessionEmail && activeEmail === sessionEmail);

    if (isMatch) {
      return sessionUser;
    }

    // Sessão residual detectada de outro usuário!
    console.warn(
      `[SessionManager] VAZAMENTO EVITADO: Sessão Supabase residual de '${sessionEmail || sessionId}' não corresponde ao usuário ativo '${activeUser.name}' (${activeId}). Expurgando sessão residual.`
    );

    // Desconecta a sessão residual local sem afetar o servidor
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});

    // Remove as chaves do Supabase auth token específicas deste host
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    }

    return null;
  } catch (err) {
    console.warn('[SessionManager] Erro ao validar integridade da sessão:', err);
    return null;
  }
};
