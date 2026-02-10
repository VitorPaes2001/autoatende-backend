const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../../utils/logger');
const whatsappService = require('./whatsapp.service');

/**
 * Baixa arquivo de mídia do WhatsApp API
 * @param {string} mediaId 
 * @param {string} clientId 
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
async function downloadMedia(mediaId, clientId) {
  try {
    const accessToken = await whatsappService.getAccessToken(clientId);
    if (!accessToken) throw new Error('No access token found for client');

    // 1. Get Media URL
    const urlRes = await axios.get(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const mediaUrl = urlRes.data.url;
    if (!mediaUrl) throw new Error('Failed to get media URL');

    // 2. Download Binary
    const writer = fs.createWriteStream(path.join(os.tmpdir(), `wa_${mediaId}.ogg`));
    const response = await axios({
      url: mediaUrl,
      method: 'GET',
      responseType: 'stream',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(writer.path));
      writer.on('error', reject);
    });

  } catch (error) {
    logger.error('[Audio Service] Download failed', error);
    throw error;
  }
}

module.exports = {
  downloadMedia
};