
require('dotenv').config();

try {
  require('axios');
  console.log('axios ok');
} catch (e) { console.error('axios missing'); }

try {
  require('form-data');
  console.log('form-data ok');
} catch (e) { console.error('form-data missing'); }

try {
  require('./src/services/whatsapp.service');
  console.log('whatsapp.service ok');
} catch (e) { console.error('whatsapp.service error', e); }

try {
  require('./src/services/ai.service');
  console.log('ai.service ok');
} catch (e) { console.error('ai.service error', e); }

try {
  require('./src/services/audio.service');
  console.log('audio.service ok');
} catch (e) { console.error('audio.service error', e); }

try {
  require('./src/services/onboarding.service');
  console.log('onboarding.service ok');
} catch (e) { console.error('onboarding.service error', e); }

try {
  require('./src/services/whatsappMessageHandler.js');
  console.log('whatsappMessageHandler ok');
} catch (e) { console.error('whatsappMessageHandler error', e); }
