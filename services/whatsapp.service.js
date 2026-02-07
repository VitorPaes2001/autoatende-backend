const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const systemEvents = require('./systemEvents.service');

const connectWhatsApp = async (clientId, data) => {
  const { waba_id, phone_number, access_token } = data;

  if (!waba_id || !phone_number || !access_token) {
    throw new Error('Missing required fields: waba_id, phone_number, access_token');
  }

  const { data: existingPhone } = await supabase
    .from('whatsapp_accounts')
    .select('client_id')
    .eq('phone_number', phone_number)
    .neq('client_id', clientId)
    .maybeSingle();

  if (existingPhone) {
    throw new Error('Phone number already linked to another account');
  }

  const { data: existingAccount } = await supabase
    .from('whatsapp_accounts')
    .select('id')
    .eq('client_id', clientId)
    .maybeSingle();

  let result;
  if (existingAccount) {
    const { data: updated, error: updateError } = await supabase
      .from('whatsapp_accounts')
      .update({
        waba_id,
        phone_number,
        access_token
      })
      .eq('id', existingAccount.id)
      .select()
      .single();
      
    if (updateError) throw new Error(updateError.message);
    result = updated;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('whatsapp_accounts')
      .insert({
        client_id: clientId,
        waba_id,
        phone_number,
        access_token,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);
    result = inserted;
  }

  await systemEvents.logEvent(clientId, 'whatsapp_connected', {
    phone_number: phone_number,
    waba_id: waba_id
  });

  return { success: true, id: result.id };
};

module.exports = {
  connectWhatsApp
};
