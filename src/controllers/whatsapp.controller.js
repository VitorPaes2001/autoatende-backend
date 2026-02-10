const whatsappService = require('../services/whatsapp.service');
const apiResponse = require('../utils/apiResponse');

const connect = async (req, res, next) => {
  try {
    const { waba_id, phone_number, access_token } = req.body;
    
    // Validar se o usuário está autenticado (já garantido pelo middleware, mas bom ter certeza)
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const clientId = req.user.id;
    
    const result = await whatsappService.connectWhatsApp(clientId, {
      waba_id,
      phone_number,
      access_token
    });
    
    return apiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
};

const getStatus = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const clientId = req.user.id;
    const status = await whatsappService.getWhatsAppStatus(clientId);
    return apiResponse.success(res, status);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  connect,
  getStatus
};
