const supabase = require('../config/supabase');

async function startProcessing(event) {
  const eventId = event?.id;
  if (!eventId) return { isDuplicate: false, eventId: null };

  const now = new Date().toISOString();

  // 1) tenta inserir como novo
  const { data: inserted, error: insertError } = await supabase
    .from('stripe_webhook_events')
    .insert({
      event_id: eventId,
      event_type: event.type || null,
      status: 'processing',
      error_message: null,
      payload: event,
      updated_at: now,
    })
    .select('id,event_id,status')
    .single();

  if (!insertError) {
    return { isDuplicate: false, eventId, recordId: inserted.id };
  }

  // 2) se já existe (unique), decide pelo status atual
  if (insertError.code === '23505') {
    const { data: existing, error: findError } = await supabase
      .from('stripe_webhook_events')
      .select('id,event_id,status')
      .eq('event_id', eventId)
      .maybeSingle();

    if (findError) throw findError;

    // já processado => duplicate real
    if (existing?.status === 'processed') {
      return { isDuplicate: true, eventId };
    }

    // failed/processing => permite retry (reprocessa)
    const { error: resumeError } = await supabase
      .from('stripe_webhook_events')
      .update({
        status: 'processing',
        error_message: null,
        payload: event,
        updated_at: now,
      })
      .eq('event_id', eventId);

    if (resumeError) throw resumeError;

    return { isDuplicate: false, eventId, resumed: true, recordId: existing?.id || null };
  }

  throw insertError;
}

async function markProcessed(eventId) {
  if (!eventId) return;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({
      status: 'processed',
      error_message: null,
      processed_at: now,
      updated_at: now,
    })
    .eq('event_id', eventId);

  if (error) throw error;
}

async function markFailed(eventId, errorMessage) {
  if (!eventId) return;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({
      status: 'failed',
      error_message: errorMessage || 'unknown',
      updated_at: now,
    })
    .eq('event_id', eventId);

  if (error) throw error;
}

module.exports = { startProcessing, markProcessed, markFailed };
