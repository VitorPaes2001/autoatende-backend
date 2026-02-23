const supabase = require('../config/supabase');

async function startProcessing(event) {
  const eventId = event?.id;

  if (!eventId) {
    return { isDuplicate: false, eventId: null };
  }

  const { data, error } = await supabase
    .from('stripe_webhook_events')
    .insert({
      event_id: eventId,
      event_type: event.type || null,
      status: 'processing',
      payload: event,
    })
    .select('id,event_id,status')
    .single();

  if (!error) {
    return { isDuplicate: false, eventId, recordId: data.id };
  }

  if (error.code === '23505') {
    return { isDuplicate: true, eventId };
  }

  throw error;
}

async function markProcessed(eventId) {
  if (!eventId) return;

  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({
      status: 'processed',
      error_message: null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  if (error) throw error;
}

async function markFailed(eventId, errorMessage) {
  if (!eventId) return;

  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({
      status: 'failed',
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  if (error) throw error;
}

module.exports = {
  startProcessing,
  markProcessed,
  markFailed,
};
