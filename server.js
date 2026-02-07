require('dotenv').config();

// 🔥 SENTRY DEVE SER INICIALIZADO ANTES DE QUALQUER COISA
const { initSentry, Sentry } = require('./src/config/sentry');

// Inicializa Sentry ANTES de importar o Express
const app = require('./src/app');

// Ativa Sentry com o app
initSentry(app);

// 🔥 Handler de erro do Sentry — SEMPRE depois das rotas
Sentry.setupExpressErrorHandler(app);

// Fallback final
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 AutoAtende AI API running on port ${PORT}`);
});

