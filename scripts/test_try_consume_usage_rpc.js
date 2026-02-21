const supabase = require('../src/config/supabase');

async function main() {
  // Usa um client real (evita UNKNOWN_CLIENT)
  const clientId = process.env.TEST_CLIENT_ID;

  if (!clientId) {
    throw new Error('Defina TEST_CLIENT_ID (um UUID existente na tabela public.clients).');
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // snapshot antes (para não poluir contadores)
  const { data: beforeRow, error: beforeErr } = await supabase
    .from('monthly_usage')
    .select('templates_used, conversations_used')
    .eq('client_id', clientId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (beforeErr) throw beforeErr;

  const beforeTemplates = beforeRow?.templates_used ?? 0;
  const beforeConvos = beforeRow?.conversations_used ?? 0;

  const call = async (delta, limit) => {
    const { data, error } = await supabase.rpc('try_consume_usage', {
      p_client_id: clientId,
      p_year: year,
      p_month: month,
      p_templates_delta: delta,
      p_conversations_delta: 0,
      p_templates_limit: limit,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  };

  try {
    const r1 = await call(1, 2);
    const r2 = await call(1, 2);
    const r3 = await call(1, 2);

    console.log({ r1, r2, r3 });

    if (!r1.allowed || !r2.allowed) throw new Error('Esperava allowed=true nas duas primeiras');
    if (r3.allowed) throw new Error('Esperava allowed=false ao exceder limite');
    if (r3.reason !== 'TEMPLATE_LIMIT_EXCEEDED') throw new Error('reason inesperado: ' + r3.reason);

    console.log('OK: try_consume_usage RPC (limit check)');
  } finally {
    // restore do estado anterior
    const { error: restoreErr } = await supabase
      .from('monthly_usage')
      .upsert({
        client_id: clientId,
        year,
        month,
        templates_used: beforeTemplates,
        conversations_used: beforeConvos,
      }, { onConflict: 'client_id,year,month' });

    if (restoreErr) {
      console.warn('WARN: falha ao restaurar monthly_usage:', restoreErr.message);
    } else {
      console.log('OK: monthly_usage restored');
    }
  }
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
