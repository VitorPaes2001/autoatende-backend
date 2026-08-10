import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { X, ChevronRight, Check, ShieldAlert, BarChart3, CreditCard } from 'lucide-react';
import { analytics } from '../lib/analytics';

const OnboardingModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState(null);
  const { session, user } = useAuth();

  useEffect(() => {
    if (user && !analytics.initialized) {
      analytics.init(user);
    }

    // Check DB state first, then fallback to localStorage
    const dbCompleted = user?.user_metadata?.onboarding_completed;
    const localCompleted = localStorage.getItem('autoatende_onboarding_completed');
    
    // If explicitly false in DB, show it. If undefined/null, check local.
    const shouldShow = dbCompleted === false || (dbCompleted === undefined && !localCompleted);

    if (shouldShow) {
      setIsOpen(true);
      analytics.track('onboarding_started');
      fetchPlanData();
    } else {
        setLoading(false);
    }
  }, [user]);

  const fetchPlanData = async () => {
    try {
      const response = await fetch('/api/billing/status', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      if (!response.ok) return;

      const data = await response.json();
      setPlanData(data);
    } catch (error) {
      console.error('Erro ao carregar plano para onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    localStorage.setItem('autoatende_onboarding_completed', 'true');
    
    // Update DB state
    try {
      await supabase.auth.updateUser({
        data: { onboarding_completed: true }
      });
    } catch (err) {
      console.error('Failed to update onboarding status in DB:', err);
    }

    analytics.track('onboarding_completed', { plan: planData?.plan });
    setIsOpen(false);
  };

  if (!isOpen || loading) return null;

  const totalSteps = 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
        
        {/* Header with Progress */}
        <div className="bg-indigo-600 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CreditCard className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider bg-indigo-500 px-2 py-1 rounded">
                Passo {step} de {totalSteps}
              </span>
              <button 
                onClick={handleFinish} 
                className="text-indigo-200 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-2xl font-bold">
              {step === 1 && "Bem-vindo ao AutoAtendeAI! 🚀"}
              {step === 2 && "Conheça seu Plano 💎"}
              {step === 3 && "Dicas Importantes 💡"}
            </h2>
            <p className="text-indigo-100 mt-2 text-sm">
              {step === 1 && "Vamos configurar sua experiência em menos de 1 minuto."}
              {step === 2 && "Entenda seus recursos e limites disponíveis."}
              {step === 3 && "Saiba como evitar bloqueios e interrupções."}
            </p>
          </div>
          
          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-800">
            <div 
              className="h-full bg-white transition-all duration-500 ease-out"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-8 min-h-[300px] flex flex-col justify-between">
          
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Painel de Controle</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Acompanhe suas métricas de atendimento em tempo real diretamente no Dashboard.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Gestão Financeira</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Acesse o menu <strong>"Meu Plano"</strong> para ver faturas, mudar de plano ou atualizar seu cartão.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Plan Details */}
          {step === 2 && planData && (
            <div className="space-y-6">
              <div className="text-center p-4 border-2 border-dashed border-indigo-100 rounded-xl bg-indigo-50">
                <p className="text-sm text-gray-500 uppercase tracking-wide font-semibold">Seu plano atual</p>
                <h3 className="text-3xl font-bold text-indigo-700 mt-1 capitalize">{planData.plan}</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-800">{planData.limits?.conversations}</p>
                  <p className="text-xs text-gray-500 font-medium">Conversas/mês</p>
                </div>
                <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-800">{planData.limits?.templates}</p>
                  <p className="text-xs text-gray-500 font-medium">Templates/mês</p>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center italic">
                * Os limites são renovados automaticamente a cada ciclo de faturamento.
              </p>
            </div>
          )}

          {/* Step 3: Tips & Warnings */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-start space-x-4 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                <ShieldAlert className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-yellow-800">Avisos de Limite</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Enviaremos alertas quando você atingir <strong>70%</strong> e <strong>90%</strong> do consumo. Fique atento para evitar interrupções!
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 p-4 bg-green-50 rounded-lg border border-green-100">
                <Check className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-green-800">Tudo Pronto!</h3>
                  <p className="text-sm text-green-700 mt-1">
                    Você já pode começar a usar o AutoAtendeAI. Se precisar de mais recursos, basta fazer upgrade no menu "Meu Plano".
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="flex justify-between items-center pt-6 mt-2">
            {step > 1 ? (
              <button 
                onClick={() => setStep(s => s - 1)}
                className="text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                Voltar
              </button>
            ) : (
              <div /> // Spacer
            )}

            <button
              onClick={() => step < totalSteps ? setStep(s => s + 1) : handleFinish()}
              className="flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-200"
            >
              {step < totalSteps ? (
                <>
                  Próximo
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                "Começar a usar"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
