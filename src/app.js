// 🔥 SENTRY PRECISA SER IMPORTADO PRIMEIRO (ANTES DO EXPRESS)
const { initSentry, Sentry } = require("./config/sentry");
const customerBillingPlanStatusTenantAwareRoutes = require('./routes/customerBillingPlanStatusTenantAware.routes'); // __AUTOATENDE_STRIPE_PHASE2R_D5G_B_CUSTOMER_BILLING_PLAN_STATUS_APP__ // __AUTOATENDE_STRIPE_PHASE2R_D5G_B_R1_PRIORITIZE_TENANT_AWARE_SEAT_STATUS__

// 🚀 Depois disso, o resto da aplicação
const express = require("express");
const cors = require("cors");

// 🔹 Middleware de contexto enriquecido
const sentryContext = require("./middlewares/sentryContext");
const { captureSignedWebhookRawBody } = require('./security/rawBodyCapture');
const { safeErrorFields, safeLogFields, safeHttpErrorResponse } = require('./security/telemetrySanitizer');
const safeLogger = require('./security/safeLogger');

const app = express();

// __AUTOATENDE_STRIPE_PHASE2R_D5G_B_CUSTOMER_BILLING_PLAN_STATUS_APP__
// __AUTOATENDE_STRIPE_PHASE2R_D5G_B_R1_PRIORITIZE_TENANT_AWARE_SEAT_STATUS__
// Montagem prioritária: precisa vir antes das rotas legadas de billing/users.
// Corrige /api/billing/status e /api/users/agents/seat-status para tenant do usuário logado.
app.use(customerBillingPlanStatusTenantAwareRoutes);


// __AUTOATENDE_STRIPE_PHASE2R_D5C_PUBLIC_ONBOARDING_PROVISIONING_STATUS_APP__
// Rota pública limitada da tela pós-pagamento.
// Montagem inline para evitar uso de variável antes da inicialização.
app.use(require('./routes/publicOnboardingProvisioning.routes'));


// Rota pública limitada da tela pós-pagamento.
// Deve ficar depois de const app = express() e antes dos guards administrativos.

const { platformOwnerOnly } = require('./middlewares/platformOwnerOnly.middleware'); // 

// __AUTOATENDE_STRIPE_PHASE2R_D4B_PLATFORM_OWNER_ONLY_APP_GUARD__

// Disable ETag to avoid 304/empty bodies on API responses
app.set("etag", false);

// 🔥 Inicializa o Sentry IMEDIATAMENTE após criar o app
initSentry(app);

// 🔹 Middlewares básicos
app.use(cors());
app.use(express.json({
  limit: "10mb",
  // Preserva bytes exatos para Stripe e Meta; os validadores usam o mesmo Buffer.
  verify: captureSignedWebhookRawBody,
}));

// 🔹 Contexto do Sentry (empresa, conversa, rota, usuário)
app.use(sentryContext);


// __AUTOATENDE_STRIPE_PHASE2R_D4B_PLATFORM_OWNER_ONLY_APP_GUARD__
// Rotas internas da operação AutoAtendeAI.
// Não usar apenas role owner/admin aqui, porque clientes também podem ser owner/admin da própria empresa.
app.use(['/api/admin/public-leads', '/api/admin/provisioning/queue'], platformOwnerOnly);

// 🔹 Rotas
const whatsappRoutes = require("./routes/whatsapp.routes");
const authMiddleware = require("./middlewares/auth.middleware");
const inboxRoutes = require("./routes/inbox.routes");
const inboxLabelsRoutes = require('./routes/inboxLabels.routes');
const usersRoutes = require("./routes/users.routes");

app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/inbox", authMiddleware, inboxRoutes);
app.use('/api/inbox-labels', inboxLabelsRoutes);
app.use("/api/users", usersRoutes);

// 🔹 Stripe Webhooks
app.use("/api/stripe", require("./routes/stripe.routes"));


// 🔹 Public Billing Checkout
app.use(require('./routes/checkoutConfirmationEmail.routes'));
app.use('/api/public/billing', require('./routes/publicBilling.routes'));

// 🔹 Attendance Control
app.use("/api/attendance", require("./routes/attendance.routes"));

// 🔹 Rotas de Negócio (Metrics & Billing)
const metricsRoutes = require("./routes/metrics.routes");
const billingRoutes = require("./routes/billing.routes");

const companyCommercialProfileRoutes = require("./routes/companyCommercialProfile.routes");
const assistantPreviewRoutes = require("./routes/assistantPreview.routes");
const opsSurfaceRoutes = require("./routes/opsSurface.routes");
const publicLeadsRoutes = require('./routes/publicLeads.routes');
const adminPublicLeadsRoutes = require('./routes/adminPublicLeads.routes');
app.use("/api/metrics", metricsRoutes);

app.use("/api/billing", billingRoutes);

safeLogger.log("[ROUTES] billing and metrics registered");

// 🔹 Healthcheck
safeLogger.log("Mounting /api/health routes...");
/* __AUTOATENDE_C1C_COMPANY_COMMERCIAL_PROFILE_MOUNT__ */
app.use("/api/company-commercial-profiles", companyCommercialProfileRoutes);
// __AUTOATENDE_C3C2A_COMPANY_COMMERCIAL_ROUTE_ALIAS__
app.use('/api/company-commercial-profile', companyCommercialProfileRoutes);
/* __AUTOATENDE_C1E1_ASSISTANT_PREVIEW_MOUNT__ */
app.use("/api/assistant-preview", assistantPreviewRoutes);
app.use("/api/ops-surface", opsSurfaceRoutes);
app.use("/api/health", require("./routes/health.routes"));
app.use('/api/public/leads', publicLeadsRoutes);
app.use('/api/admin/public-leads', adminPublicLeadsRoutes);
// 🔹 Debug Routes (TEMPORARY)
app.get("/__debug/routes", (req, res) => {
  const routes = [];
  if (app._router?.stack) {
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      } else if (middleware.name === "router") {
        routes.push({
          name: middleware.name,
          regexp: middleware.regexp?.toString?.() || null
        });
      }
    });
  }
  res.json(routes);
});

// 🔹 Rota de teste do Sentry
app.get("/sentry-test", () => {
  throw new Error("Teste de erro Sentry - AutoAtende AI");
});

// Internal provisioning routes must be registered before the terminal error handler.
app.use('/api/admin/provisioning', require('./routes/adminProvisioningQueue.routes'));

// 🔴 ERROR HANDLER GLOBAL (manual, compatível com Express 4/5)
app.use((err, req, res, next) => {
  /* __AUTOATENDE_V4_R17B_A2_EXPECTED_24H_WINDOW_ERROR_HANDLER__ */
  const statusCode = err.statusCode || err.status || 500;
  const isExpectedOperationalError =
    err?.code === "WHATSAPP_24H_WINDOW_CLOSED" ||
    err?.details?.code === "WHATSAPP_24H_WINDOW_CLOSED";

  if (process.env.SENTRY_DSN && !isExpectedOperationalError) {
    Sentry.captureException(err);
  }

  if (isExpectedOperationalError) {
    safeLogger.warn("[Expected Operational Error]", safeLogFields({
      error_code: err.code || err.details?.code || "WHATSAPP_24H_WINDOW_CLOSED",
      status_code: statusCode,
      route: String(req.originalUrl || req.url || '').split('?')[0],
      method: req.method,
      reason: err.details?.reason || null,
      status: err.details?.template_required ? 'template_required' : 'operational',
    }));
  } else {
    safeLogger.error("[Unhandled Error]", safeErrorFields(err, {
      method: req.method,
      route: String(req.originalUrl || req.url || '').split('?')[0],
    }));
  }

  res.status(statusCode).json(safeHttpErrorResponse(err, statusCode));
});

module.exports = app;

// __AUTOATENDE_V4_R15A_R2B_CONVERSATION_LABELS_BACKEND_AFTER_MANUAL_SQL__

// __AUTOATENDE_V4_R15A_R2C_FIX_INBOX_LABELS_ROUTE_MOUNT__

// __AUTOATENDE_V4_R15A_R2D_FIX_INBOX_LABELS_APP_ORDER__
