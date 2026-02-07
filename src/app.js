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
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    // Armazena rawBody para validação de assinatura do Stripe
    if (req.originalUrl.includes('/stripe/webhook')) {
      req.rawBody = buf.toString();
    }
  }
}));

// 🔹 Contexto do Sentry (empresa, conversa, rota, usuário)
app.use(sentryContext);

// 🔹 Rotas
const whatsappRoutes = require('./routes/whatsapp.routes');
app.use('/api/whatsapp', whatsappRoutes);

// 🔹 Stripe Webhooks
app.use('/api/stripe', require('./routes/stripe.routes'));

// 🔹 Attendance Control
app.use('/api/attendance', require('./routes/attendance.routes'));

// 🔹 Metrics
app.use('/api/metrics', require('./routes/metrics.routes'));

// 🔹 Healthcheck
app.use('/api/health', require('./routes/health.routes'));

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

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    error: true,
    message,
    ...(err.details && { details: err.details }),
    ...(err.code && { code: err.code })
  });
});

module.exports = app;

