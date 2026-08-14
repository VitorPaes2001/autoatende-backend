/* __AUTOATENDE_ASSISTANT_CENTRAL_STATUS_USAGE_UI_V20_C1_R3__ */
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { analytics } from '../lib/analytics';


function aaUsageSafePercent(
  usedValue,
  limitValue
) {
  const used = Number(usedValue);
  const limit = Number(limitValue);

  if (
    !Number.isFinite(used) ||
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return 0;
  }

  return Math.max(
    0,
    (used / limit) * 100
  );
}

const UsageWarning = () => {
  const [status, setStatus] = useState(null);
  const [visible, setVisible] = useState(true);
  const { session, user } = useAuth();
  const trackedRef = useRef(false);

  const fetchBillingStatus = React.useCallback(async () => {
    try {
      const response = await fetch('/api/billing/status', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      if (!response.ok) return;
      
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Erro ao verificar status de billing:', error);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!session) return;
    if (user && !analytics.initialized) analytics.init(user);
    fetchBillingStatus();
  }, [fetchBillingStatus, session, user]);

  useEffect(() => {
    if (!status || trackedRef.current) return;

    const usage = status?.usage || {};
    const limits = status?.limits || {};
    const convPercent = aaUsageSafePercent(usage?.conversations, limits?.conversations);
    const tempPercent = aaUsageSafePercent(usage?.templates, limits?.templates);
    const maxPercent = Math.max(convPercent, tempPercent);

    if (maxPercent >= 90) {
      analytics.track('limit_90_reached', { 
        percent: Math.round(maxPercent),
        resource: convPercent > tempPercent ? 'conversations' : 'templates'
      });
      trackedRef.current = true;
    } else if (maxPercent >= 70) {
      analytics.track('limit_70_reached', {
        percent: Math.round(maxPercent),
        resource: convPercent > tempPercent ? 'conversations' : 'templates'
      });
      trackedRef.current = true;
    }
  }, [status]);

  const handleUpgradeClick = () => {
    analytics.track('clicked_upgrade', { source: 'usage_warning_banner' });
  };

  if (!status || !visible) return null;

  const usage = status?.usage || {};
  const limits = status?.limits || {};
  
  // Calculate percentages
  const convPercent = aaUsageSafePercent(usage?.conversations, limits?.conversations);
  const tempPercent = aaUsageSafePercent(usage?.templates, limits?.templates);
  
  const maxPercent = Math.max(convPercent, tempPercent);
  const resourceName = convPercent > tempPercent ? 'conversas' : 'templates';

  // Determine alert level
  if (maxPercent < 70) return null;

  const isCritical = maxPercent >= 90;
  const bgColor = isCritical ? 'bg-red-600' : 'bg-yellow-500';
  const textColor = 'text-white';

  return (
    <div className={`${bgColor} ${textColor} px-4 py-3 shadow-lg relative transition-all duration-300`}>
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-white bg-opacity-20 rounded-full">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm">
              {isCritical ? 'Atenção: Limite quase atingido!' : 'Alerta de Consumo'}
            </p>
            <p className="text-xs opacity-90 mt-0.5">
              Você já utilizou <strong>{Math.round(maxPercent)}%</strong> das suas {resourceName} mensais.
              {isCritical 
                ? ' Evite bloqueios fazendo um upgrade agora.' 
                : ' Acompanhe seu consumo para não ficar sem serviço.'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Link 
            to="/billing" 
            onClick={handleUpgradeClick}
            className="px-4 py-1.5 bg-white text-gray-900 text-xs font-bold rounded-full hover:bg-opacity-90 transition-opacity whitespace-nowrap"
          >
            Ver Plano
          </Link>
          <button 
            onClick={() => setVisible(false)}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsageWarning;
