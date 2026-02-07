// 🔥 SENTRY PRECISA SER IMPORTADO PRIMEIRO (ANTES DO EXPRESS)
const { initSentry, Sentry } = require('./config/sentry');

// 🚀 Depois disso, o resto da aplicação
const express = require('express');
const cors = require('cors');

// 🔹 Middleware de contexto enriquecido
const sentryContext = require('./middlewares/sentryContext');

const app = express();

// 🔥 Inicializa o Sentry IMEDIATAMENTE após criar o app
initSentry(app);

// 🔹 Middlewares básicos
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 🔹 Contexto do Sentry (empresa, conversa, rota, usuário)
app.use(sentryContext);

// 🔹 Rotas
const whatsappRoutes = require('./routes/whatsapp.routes');
app.use('/api/whatsapp', whatsappRoutes);

// 🔹 Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 🔹 Rota de teste do Sentry
app.get('/sentry-test', () => {
  throw new Error('Teste de erro Sentry - AutoAtende AI');
});

// 🔴 ERROR HANDLER GLOBAL (manual, compatível com Express 4/5)
app.use((err, req, res, next) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  console.error('[Unhandled Error]', err);

  res.status(500).json({
    error: 'Internal server error',
  });
});

module.exports = app;

