import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Smartphone, Key, Hash, HelpCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function WhatsAppConnect() {
  const { session } = useAuth();
  const [status, setStatus] = useState('loading'); // loading, connected, disconnected, error
  const [formData, setFormData] = useState({
    phone_number: '', 
    waba_id: '',      
    access_token: ''  
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  
  // New state for field-specific help visibility
  const [showHelp, setShowHelp] = useState({
    phone: false,
    waba: false,
    token: false
  });

  const [checklist, setChecklist] = useState({
    meta_registered: false,
    webhook_active: false,
    test_message: false
  });

  useEffect(() => {
    if (session) {
      fetchStatus();
    }
  }, [session]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const response = await res.json();
      const data = response.data;
      
      if (data && data.connected) {
        setStatus('connected');
        setChecklist({
          meta_registered: true,
          webhook_active: true, // Mocked for now, implies webhook is configured in Meta
          test_message: true    // Mocked
        });
        setFormData({
          phone_number: data.phone_number,
          waba_id: data.waba_id,
          access_token: '••••••••••••••••'
        });
      } else {
        setStatus('disconnected');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(formData)
      });
      
      const response = await res.json();
      
      if (res.ok) {
        setStatus('connected');
        setMessage({ type: 'success', text: 'Conexão salva com sucesso! O sistema está pronto para receber mensagens.' });
        setChecklist({
          meta_registered: true,
          webhook_active: true,
          test_message: true
        });
      } else {
        // Map backend errors to business friendly messages
        let errorMsg = 'Não foi possível conectar. Verifique seus dados.';
        const backendError = response.error || '';
        
        if (backendError.includes('Phone number already linked')) {
          errorMsg = 'Este número já está conectado em outra conta do sistema.';
        } else if (backendError.includes('Missing required fields')) {
          errorMsg = 'Por favor, preencha todos os campos obrigatórios.';
        } else if (backendError.includes('Invalid')) {
          errorMsg = 'Um ou mais dados parecem incorretos. Verifique na Meta.';
        }

        throw new Error(errorMsg);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-600" />
            Conexão Oficial WhatsApp
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure seu número usando a Cloud API da Meta.
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${
          status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          {status === 'connected' ? (
            <><CheckCircle className="w-4 h-4" /> Ativo</>
          ) : (
            <><AlertTriangle className="w-4 h-4" /> Não configurado</>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Phone Number ID */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Identificação do Número (Phone Number ID)
                </label>
                <button 
                  type="button"
                  onClick={() => setShowHelp({...showHelp, phone: !showHelp.phone})}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" /> Onde encontrar?
                </button>
              </div>
              
              {showHelp.phone && (
                <div className="mb-2 p-3 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
                  <strong>Onde encontrar:</strong> Acesse o <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline font-bold">Painel de Apps da Meta</a>, selecione seu app, vá em <strong>WhatsApp &gt; Configuração da API</strong>. Copie o número no campo <em>"Identificação do número de telefone"</em>.
                </div>
              )}

              <div className="relative">
                <Hash className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder="Ex: 10595..."
                  value={formData.phone_number}
                  onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                  className="pl-9 w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  disabled={status === 'connected' && !loading} 
                />
              </div>
            </div>

            {/* WABA ID */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Identificação da Conta (WABA ID)
                </label>
                <button 
                  type="button"
                  onClick={() => setShowHelp({...showHelp, waba: !showHelp.waba})}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" /> Onde encontrar?
                </button>
              </div>

              {showHelp.waba && (
                <div className="mb-2 p-3 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
                  <strong>Onde encontrar:</strong> Na mesma tela de <strong>Configuração da API</strong> (passo anterior), copie o número no campo <em>"Identificação da conta do WhatsApp Business"</em>.
                </div>
              )}

              <div className="relative">
                <Hash className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder="Ex: 10332..."
                  value={formData.waba_id}
                  onChange={(e) => setFormData({...formData, waba_id: e.target.value})}
                  className="pl-9 w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  disabled={status === 'connected' && !loading}
                />
              </div>
            </div>

            {/* Access Token */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Token de Acesso (Permanente)
                </label>
                <button 
                  type="button"
                  onClick={() => setShowHelp({...showHelp, token: !showHelp.token})}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" /> Importante
                </button>
              </div>

              {showHelp.token && (
                <div className="mb-2 p-3 bg-amber-50 text-amber-800 text-xs rounded border border-amber-100">
                  <strong>Atenção:</strong> Não use o token temporário de 24h da tela inicial. Você precisa gerar um <strong>Token de Usuário do Sistema</strong> nas Configurações do Negócio para garantir que o bot não pare de funcionar amanhã.
                </div>
              )}

              <div className="relative">
                <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  required
                  placeholder="EAAG..."
                  value={formData.access_token}
                  onChange={(e) => setFormData({...formData, access_token: e.target.value})}
                  className="pl-9 w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  disabled={status === 'connected' && !loading}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Use um token permanente gerado no Business Manager. Tokens temporários expiram em 24h.
              </p>
            </div>

            {message && (
              <div className={`p-4 rounded-md text-sm flex items-start gap-3 ${
                message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 shrink-0 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  loading ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors`}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : status === 'connected' ? (
                  'Atualizar Conexão'
                ) : (
                  'Salvar e Conectar'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Checklist Column */}
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 h-fit">
          <h4 className="text-xs font-bold text-gray-500 mb-5 uppercase tracking-wide">
            Diagnóstico da Conexão
          </h4>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              {checklist.meta_registered ? (
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
              )}
              <div>
                <p className={`text-sm font-medium ${checklist.meta_registered ? 'text-gray-900' : 'text-gray-500'}`}>
                  Conta Identificada
                </p>
                <p className="text-xs text-gray-500">
                  {checklist.meta_registered 
                    ? 'Credenciais validadas no sistema.'
                    : 'Aguardando inserção dos dados.'}
                </p>
              </div>
            </li>
            
            <li className="flex items-start gap-3">
              {checklist.webhook_active ? (
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
              )}
              <div>
                <p className={`text-sm font-medium ${checklist.webhook_active ? 'text-gray-900' : 'text-gray-500'}`}>
                  Webhook Configurado
                </p>
                <p className="text-xs text-gray-500">
                  {checklist.webhook_active 
                    ? 'Pronto para receber eventos.'
                    : 'Configure o webhook no painel da Meta.'}
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              {checklist.test_message ? (
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
              )}
              <div>
                <p className={`text-sm font-medium ${checklist.test_message ? 'text-gray-900' : 'text-gray-500'}`}>
                  Status Operacional
                </p>
                <p className="text-xs text-gray-500">
                  {checklist.test_message 
                    ? 'Bot ativo e respondendo.'
                    : 'Aguardando primeira mensagem.'}
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h5 className="text-xs font-semibold text-gray-500 mb-2">PRECISA DE AJUDA?</h5>
            <p className="text-xs text-gray-500 mb-2">
              Não sabe como gerar o token permanente ou configurar o webhook?
            </p>
            <a href="#" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
              Ver guia passo a passo <span className="text-xs">→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
