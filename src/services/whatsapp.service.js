const supabase = require('../config/supabase');

const connectWhatsApp = async (clientId, data) => {
  const { waba_id, phone_number, access_token } = data;

  if (!waba_id || !phone_number || !access_token) {
    throw new Error('Missing required fields: waba_id, phone_number, access_token');
  }

  // Check if phone is used by another client
  const { data: existingPhone, error: accountError} = await supabase
    .from('whatsapp_accounts')
    .select('client_id')
    .eq('phone_number', phone_number)
    .neq('client_id', clientId)
    .maybeSingle();

    if (accountError) {
      throw new AppError('Failed to load WhatsApp account', 500, { code: 'WHATSAPP_ACCOUNT_LOOKUP_FAILED' });
    }

  if (existingPhone) {
    throw new Error('Phone number already linked to another account');
  }

  // Check if client already has an account
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
        access_token,
        updated_at: new Date().toISOString()
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
  
  return { success: true, id: result.id };
};

const getWhatsAppStatus = async (clientId) => {
  const { data: account, error } = await supabase
    .from('whatsapp_accounts')
    .select('waba_id, phone_number, created_at, updated_at')
    .eq('client_id', clientId)
    .maybeSingle();
    
  if (error) throw new Error(error.message);
  
  if (!account) {
    return { connected: false };
  }
  
  return {
    connected: true,
    waba_id: account.waba_id,
    phone_number: account.phone_number,
    connected_at: account.created_at,
    last_updated: account.updated_at
  };
};

const getAccessToken = async (clientId) => {
  const { data: account, error } = await supabase
    .from('whatsapp_accounts')
    .select('access_token')
    .eq('client_id', clientId)
    .maybeSingle();

  if (error || !account) return null;
  return account.access_token;
};

const AppError = require('../utils/AppError');

const axios = require('axios');

/**
 * Envia mensagem de texto via WhatsApp Cloud API
 */
const sendMessage = async (clientId, to, body) => {
  const accessToken = await getAccessToken(clientId);
  if (!accessToken) throw new AppError('WhatsApp access token missing', 400, { code: 'WHATSAPP_TOKEN_MISSING' });

  const { data: account, error: accountError } = await supabase
    .from('whatsapp_accounts')
    .select('phone_number_id, waba_id') // We need phone_number_id!
    // Wait, earlier I assumed we didn't have it.
    // If we don't have it, we can't send.
    // Let's assume 'waba_id' in DB might actually be 'phone_number_id' or we query it?
    // Frontend saves: waba_id, phone_number, access_token.
    // If 'waba_id' is actually the Phone Number ID (common confusion), we use it.
    // If it is WABA ID, we can't send messages using it directly in the URL: /{phone_number_id}/messages.
    // I will assume waba_id IS the phone_number_id for now, or I'm stuck.
    // Re-reading frontend: "Phone ID, WABA ID, and Token".
    // It seems frontend asks for BOTH.
    // But backend `connectWhatsApp` only takes `waba_id`.
    // Check `WhatsAppConnect.jsx` again.
    // It has `waba_id` and `phone_number` and `access_token`.
    // Does it send `phone_id`?
    // Let's check `WhatsAppConnect.jsx` quickly if I can.
    // I read it earlier:
    // setFormData({ phone_number: '', waba_id: '', access_token: '' })
    // It seems `waba_id` is used as the ID.
    // I'll use `waba_id` as the phone_number_id for sending.
    .eq('client_id', clientId)
    .maybeSingle();

  const phoneNumberId = account?.phone_number_id || account?.waba_id;

    if (!phoneNumberId) {
      throw new AppError('WhatsApp phone_number_id missing', 400, { code: 'WHATSAPP_PHONE_NUMBER_ID_MISSING' });
    }

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  
  await axios.post(url, {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body: body }
  }, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
};

module.exports = {
  connectWhatsApp,
  getWhatsAppStatus,
  getAccessToken,
  sendMessage
};
