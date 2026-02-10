import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CreditCard, CheckCircle, AlertTriangle, BarChart3, Users, MessageSquare, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { analytics } from '../lib/analytics';

const BillingPage = () => {
  const { session, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user && !analytics.initialized) analytics.init(user);
    analytics.track('opened_billing_page');
    fetchBillingStatus();
  }, [user]);

  const fetchBillingStatus = async () => {
    try {
      console.log('[BillingPage] Fetching status...');
      const token = session?.access_token;
      console.log('[BillingPage] Token:', token ? 'Present' : 'Missing');
      
      const response = await fetch('/api/billing/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar dados do plano');
      }

      const result = await response.json();
      setData(result);

      if (result.blocked?.isBlocked) {
        analytics.track('blocked_limit', {
          reason: result.blocked.reason,
          action: result.blocked.action
        });
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePortalRedirect = async () => {
    setPortalLoading(true);
    analytics.track('clicked_upgrade', { source: 'billing_page_manage_button' });
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          returnUrl: window.location.href
        })
      });

      const result = await response.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error('URL de redirecionamento não encontrada');
      }
    } catch (err) {
      alert('Erro ao redirecionar para o portal: ' + err.message);
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-lg">
        <h3 className="text-lg font-bold flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Erro
        </h3>
        <p>{error}</p>
        <button 
          onClick={fetchBillingStatus}
          className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-sm font-medium transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { plan, status, limits = {}, usage = {}, blocked = {} } = data;

  const getStatusColor = (s) => {
    switch (s) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trialing': return 'bg-blue-100 text-blue-800';
      case 'past_due': return 'bg-red-100 text-red-800';
      case 'unpaid': return 'bg-red-100 text-red-800';
      case 'canceled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (s) => {
    const map = {
      active: 'Ativo',
      trialing: 'Em Teste',
      past_due: 'Pagamento Pendente',
      unpaid: 'Não Pago',
      canceled: 'Cancelado'
    };
    return map[s] || s;
  };

  const UsageBar = ({ label, icon: Icon, used, limit, color = "blue" }) => {
    const percentage = Math.min(Math.round((used / limit) * 100), 100);
    const isExceeded = used >= limit;
    
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center text-sm font-medium text-gray-700">
            <Icon className="w-4 h-4 mr-2 text-gray-500" />
            {label}
          </div>
          <span className={`text-xs font-bold ${isExceeded ? 'text-red-600' : 'text-gray-600'}`}>
            {used} / {limit} ({percentage}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full transition-all duration-500 ${isExceeded ? 'bg-red-500' : `bg-${color}-600`}`} 
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Meu Plano</h2>
          <p className="text-gray-500">Gerencie sua assinatura e acompanhe o consumo</p>
        </div>
        <button
          onClick={handlePortalRedirect}
          disabled={portalLoading}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {portalLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
          Gerenciar Assinatura
        </button>
      </div>

      {/* Blocked Alert */}
      {blocked?.isBlocked && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-red-800 font-bold">Serviço Interrompido</h3>
              <p className="text-red-700 text-sm mt-1">
                {blocked.reason === 'payment_required' && 'O pagamento da sua fatura falhou. Atualize seus dados para restaurar o acesso.'}
                {blocked.reason === 'limit_exceeded' && 'Você atingiu os limites do seu plano atual. Faça um upgrade para continuar usando.'}
                {!['payment_required', 'limit_exceeded'].includes(blocked.reason) && 'Sua conta possui restrições de acesso.'}
              </p>
              {blocked.action && (
                <button 
                  onClick={() => {
                    analytics.track('clicked_upgrade', { source: 'billing_page_blocked_banner' });
                    handlePortalRedirect();
                  }}
                  className="mt-3 text-sm font-semibold text-red-700 hover:text-red-900 underline"
                >
                  {blocked.action === 'update_payment' ? 'Atualizar Pagamento Agora →' : 'Fazer Upgrade Agora →'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plan Info Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <CreditCard className="w-6 h-6 text-indigo-600" />
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
              {getStatusLabel(status)}
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Plano Atual</h3>
          <p className="text-3xl font-bold text-gray-900 mt-1 capitalize">{plan}</p>
          <div className="mt-6 pt-6 border-t border-gray-100">
             <ul className="space-y-3">
               <li className="flex items-center text-sm text-gray-600">
                 <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                 Atendimento Automático
               </li>
               {data.features?.attendance_transfer && (
                 <li className="flex items-center text-sm text-gray-600">
                   <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                   Transferência para Humanos
                 </li>
               )}
               {data.features?.analytics && (
                 <li className="flex items-center text-sm text-gray-600">
                   <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                   Relatórios e Métricas
                 </li>
               )}
               {data.features?.custom_integration && (
                 <li className="flex items-center text-sm text-gray-600">
                   <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                   Integrações Personalizadas
                 </li>
               )}
               {data.features?.whitelabel && (
                 <li className="flex items-center text-sm text-gray-600">
                   <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                   Marca Própria (White-label)
                 </li>
               )}
             </ul>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-gray-500" />
            Consumo do Mês
          </h3>
          
          <div className="space-y-6">
            <UsageBar 
              label="Conversas Iniciadas" 
              icon={MessageSquare} 
              used={usage.conversations || 0} 
              limit={limits.conversations || 0}
              color="blue"
            />
            
            <UsageBar 
              label="Templates Enviados" 
              icon={FileText} 
              used={usage.templates || 0} 
              limit={limits.templates || 0}
              color="purple"
            />
            
            <UsageBar 
              label="Agentes Cadastrados" 
              icon={Users} 
              used={usage.agents || 0} 
              limit={limits.agents || 0}
              color="orange"
            />
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500 flex items-start">
             <div className="mr-2 mt-0.5">ℹ️</div>
             <p>
               Os limites de conversas e templates são renovados mensalmente. 
               Agentes são contados pelo total de usuários ativos cadastrados na plataforma.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
