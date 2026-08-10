'use strict';

/**
 * __AUTOATENDE_STRIPE_PHASE2R_D4B_PLATFORM_OWNER_ONLY_BACKEND_GUARD__
 *
 * Proteção interna da operação AutoAtendeAI.
 *
 * Uso atual:
 * - /api/admin/public-leads
 * - /api/admin/provisioning/queue
 *
 * Autoridade única: app_metadata.platform_role === "platform_owner".
 * app_metadata é emitido no servidor pelo provedor de autenticação; entradas
 * controláveis pelo cliente, e-mail e aliases de role não concedem acesso.
 */

const https = require('https');
const {
  getSupabaseAdminConfig,
  isSupabaseAdminUnavailableError,
} = require('../config/supabase');

const MARKER = '__AUTOATENDE_STRIPE_PHASE2R_D4B_PLATFORM_OWNER_ONLY_BACKEND_GUARD__';
function hasAuthoritativePlatformOwnerClaim(user) {
  return Boolean(
    user &&
    user.app_metadata &&
    user.app_metadata.platform_role === 'platform_owner'
  );
}

function extractBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  const token = match ? match[1].trim() : '';
  if (!token || token === 'undefined' || token === 'null') return '';
  return token;
}


function fetchSupabaseUser(accessToken) {
  const { url: supabaseUrl, key: apiKey } = getSupabaseAdminConfig();

  return new Promise((resolve, reject) => {
    const url = new URL('/auth/v1/user', supabaseUrl);

    const req = https.request(
      url,
      {
        method: 'GET',
        timeout: 8000,
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = body ? JSON.parse(body) : null;
          } catch {
            parsed = null;
          }

          if (res.statusCode >= 200 && res.statusCode < 300 && parsed) {
            resolve(parsed);
            return;
          }

          const error = new Error('Invalid Supabase auth token');
          error.statusCode = res.statusCode || 401;
          error.code = 'platform_owner_auth_invalid';
          error.details = parsed || body;
          reject(error);
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(Object.assign(new Error('Supabase auth timeout'), { statusCode: 504, code: 'platform_owner_auth_timeout' }));
    });

    req.on('error', reject);
    req.end();
  });
}

async function platformOwnerOnly(req, res, next) {
  try {
    const token = extractBearer(req);

    if (!token) {
      return res.status(401).json({
        ok: false,
        code: 'platform_owner_auth_required',
        message: 'Autenticação obrigatória para área interna da AutoAtendeAI.',
      });
    }

    const user = await fetchSupabaseUser(token);
    if (!hasAuthoritativePlatformOwnerClaim(user)) {
      return res.status(403).json({
        ok: false,
        code: 'platform_owner_forbidden',
        message: 'Área restrita à operação interna da AutoAtendeAI.',
      });
    }

    req.platformOwnerUser = {
      id: user.id,
      authority: 'app_metadata.platform_role',
      marker: MARKER,
    };

    return next();
  } catch (error) {
    if (isSupabaseAdminUnavailableError(error)) {
      return res.status(503).json({
        ok: false,
        code: error.code,
        message: 'Falha ao validar permissão interna.',
      });
    }

    const status = error.statusCode === 500 || error.statusCode === 504 ? error.statusCode : 401;

    return res.status(status).json({
      ok: false,
      code: error.code || 'platform_owner_auth_failed',
      message: status >= 500
        ? 'Falha ao validar permissão interna.'
        : 'Sessão inválida ou expirada.',
    });
  }
}

module.exports = {
  MARKER,
  hasAuthoritativePlatformOwnerClaim,
  platformOwnerOnly,
};
