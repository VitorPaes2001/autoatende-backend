require('dotenv').config();
const app = require('./src/app');

// 🛠️ DIAGNÓSTICO DE ROTAS (OBRIGATÓRIO PARA DEBUG)
console.log('--------------------------------------------------');
console.log('🚀 SERVER STARTING - ROUTE AUDIT');
console.log('--------------------------------------------------');

function printRoutes() {
  if (!app._router || !app._router.stack) {
    console.error('❌ CRITICAL: app._router is not available!');
    return;
  }

  const routes = app._router.stack
    .map(layer => {
      if (layer.route) {
        return `ROUTE: ${layer.route.path}`;
      } else if (layer.name === 'router') {
        // Tenta extrair o path do regex (aproximado)
        return `ROUTER MOUNT: ${layer.regexp.toString()}`;
      } else if (layer.name === 'bound dispatch') {
         return `DISPATCH: ${layer.name}`;
      }
      return null;
    })
    .filter(Boolean);

  console.log('REGISTERED ROUTES:', routes);
  
  // Log detalhado para healthcheck especificamente
  const hasHealth = app._router.stack.some(l => 
    l.name === 'router' && l.regexp.toString().includes('health')
  );
  console.log('HEALTHCHECK DETECTED:', hasHealth ? '✅ YES' : '❌ NO');
}

printRoutes();
console.log('--------------------------------------------------');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 AutoAtende AI API running on port ${PORT}`);
  console.log(`👉 Test internal: curl http://localhost:${PORT}/api/health`);
});
