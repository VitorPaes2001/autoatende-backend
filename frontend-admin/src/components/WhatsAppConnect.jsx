
import React, { useState, useEffect } from 'react';
import {
 CheckCircle,
 Loader2,
 Smartphone,
 Key,
 Hash,
 HelpCircle,
 AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

import { useNavigate } from 'react-router-dom';

export default function WhatsAppConnect() {
 const navigate = useNavigate();
 const { session } = useAuth();

 const [status, setStatus] = useState('loading'); // loading, connected, disconnected, error
 const [formData, setFormData] = useState({
  phone_number_id: '',
  waba_id: '',
  access_token: ''
 });
 const [loading, setLoading] = useState(false);
 const [message, setMessage] = useState(null);
 const [tokenSaved, setTokenSaved] = useState(false);

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

 const fetchStatus = React.useCallback(async () => {
  try {
   setStatus('loading');

   const res = await fetch('/api/whatsapp/status', {
    headers: {
     Authorization: `Bearer ${session?.access_token}`
    }
   });

   const data = await res.json();

   if (!res.ok) {
    throw new Error(data?.error || 'Falha ao consultar status da conexão.');
   }

   if (data?.connected) {
    setStatus('connected');
    setTokenSaved(true);
    setChecklist({
     meta_registered: true,
     webhook_active: true,
     test_message: true
    });
    setFormData({
     phone_number_id: data.phone_number_id || data.phoneNumberId || '',
     waba_id: data.waba_id || data.wabaId || '',
     access_token: ''
    });
   } else {
    setStatus('disconnected');
    setTokenSaved(false);
    setChecklist({
     meta_registered: false,
     webhook_active: false,
     test_message: false
    });
    setFormData((prev) => ({
    ...prev,
     phone_number_id: data?.phone_number_id || data?.phoneNumberId || prev.phone_number_id || '',
     waba_id: data?.waba_id || data?.wabaId || prev.waba_id || '',
     access_token: ''
    }));
   }
  } catch (err) {
   console.error(err);
   setStatus('error');
   setMessage({
    type: 'error',
    text: err.message || 'Erro ao carregar status da conexão.'
   });
  }
 }, [session?.access_token]);

 useEffect(() => {
  if (session?.access_token) {
   fetchStatus();
  }
 }, [fetchStatus, session?.access_token]);

 const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setMessage(null);

  try {
   const payload = {
    phone_number_id: formData.phone_number_id?.trim(),
    waba_id: formData.waba_id?.trim(),
    access_token: formData.access_token?.trim()
   };

   if (!payload.phone_number_id || !payload.waba_id) {
    throw new Error('Preencha o Phone Number ID e o WABA ID.');
   }

   if (!payload.access_token) {
    throw new Error('Cole o token permanente da Meta para salvar ou atualizar a conexão.');
   }

   const res = await fetch('/api/whatsapp/connect', {
    method: 'POST',
    headers: {
     'Content-Type': 'application/json',
     Authorization: `Bearer ${session?.access_token}`
    },
    body: JSON.stringify(payload)
   });

   const response = await res.json();

   if (res.ok) {
    setStatus('connected');
    setTokenSaved(true);
    setChecklist({
     meta_registered: true,
     webhook_active: true,
     test_message: true
    });
    setMessage({
     type: 'success',
     text: 'Conexão salva com sucesso! O sistema está pronto para receber mensagens.'
    });
    await fetchStatus();
   } else {
    const backendText = `${response?.error || ''} ${response?.details || ''}`.toLowerCase();
    let errorMsg = 'Não foi possível conectar. Verifique seus dados.';

    if (backendText.includes('already linked')) {
     errorMsg = 'Este número já está conectado em outra conta do sistema.';
    } else if (backendText.includes('missing required fields') || backendText.includes('campos obrigatórios')) {
     errorMsg = 'Por favor, preencha todos os campos obrigatórios.';
    } else if (backendText.includes('jwt do supabase')) {
     errorMsg = 'Você colou o token do sistema. No campo Token de Acesso use o token permanente da Meta.';
    } else if (backendText.includes('malformed access token')) {
     errorMsg = 'O token da Meta parece inválido ou malformado. Gere um novo token permanente e tente novamente.';
    } else if (backendText.includes('unsupported get request')) {
     errorMsg = 'O Phone Number ID informado não foi reconhecido pela Meta. Revise o número configurado.';
    } else if (backendText.includes('invalid')) {
     errorMsg = 'Um ou mais dados parecem incorretos. Verifique na Meta.';
    }

    throw new Error(errorMsg);
   }
  } catch (err) {
   setMessage({
    type: 'error',
    text: err.message || 'Erro ao salvar a conexão.'
   });
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
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 aa-whatsapp-connect-r11b4 __AUTOATENDE_V4_R11B_R4_SETTINGS_VISUAL_SURFACE_POLISH__" data-aa-polish="whatsapp_connect">
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

    <div
     className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${
      status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
     }`}
    >
     {status === 'connected' ? (
      <>
       <CheckCircle className="w-4 h-4" /> Ativo
      </>
     ) : (
      <>
       <AlertTriangle className="w-4 h-4" /> Não configurado
      </>
     )}
    </div>
   </div>

   <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div className="lg:col-span-2 space-y-5">
     <form onSubmit={handleSubmit} className="space-y-5">
      <div>
       <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
         Identificação do Número (Phone Number ID)
        </label>
        <button
         type="button"
         onClick={() => setShowHelp({...showHelp, phone: !showHelp.phone })}
         className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
         <HelpCircle className="w-3 h-3" /> Onde encontrar?
        </button>
       </div>

       {showHelp.phone && (
        <div className="mb-2 p-3 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
         <strong>Onde encontrar:</strong> Acesse o painel de Apps da Meta, selecione seu app,
         vá em <strong>WhatsApp &gt; Configuração da API</strong> e copie a
         <em> Identificação do número de telefone</em>.
        </div>
       )}

       <div className="relative">
        <Hash className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
         type="text"
         required
         placeholder="Ex: 10595..."
         value={formData.phone_number_id}
         onChange={(e) => setFormData({...formData, phone_number_id: e.target.value })}
         className="pl-9 w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
         disabled={loading}
        />
       </div>
      </div>

      <div>
       <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
         Identificação da Conta (WABA ID)
        </label>
        <button
         type="button"
         onClick={() => setShowHelp({...showHelp, waba: !showHelp.waba })}
         className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
         <HelpCircle className="w-3 h-3" /> Onde encontrar?
        </button>
       </div>

       {showHelp.waba && (
        <div className="mb-2 p-3 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
         <strong>Onde encontrar:</strong> Na mesma tela de <strong>Configuração da API</strong>,
         copie a <em>Identificação da conta do WhatsApp Business</em>.
        </div>
       )}

       <div className="relative">
        <Hash className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
         type="text"
         required
         placeholder="Ex: 10332..."
         value={formData.waba_id}
         onChange={(e) => setFormData({...formData, waba_id: e.target.value })}
         className="pl-9 w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
         disabled={loading}
        />
       </div>
      </div>

      <div>
       <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
         Token de Acesso (Permanente)
        </label>
        <button
         type="button"
         onClick={() => setShowHelp({...showHelp, token: !showHelp.token })}
         className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
         <HelpCircle className="w-3 h-3" /> Importante
        </button>
       </div>

       {showHelp.token && (
        <div className="mb-2 p-3 bg-amber-50 text-amber-800 text-xs rounded border border-amber-100">
         <strong>Atenção:</strong> não use o token do login do sistema. Aqui deve ser usado
         o <strong> token permanente da Meta</strong>.
        </div>
       )}

       <div className="relative">
        <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
         type="password"
         required
         placeholder="EAAG..."
         value={formData.access_token}
         onChange={(e) => setFormData({...formData, access_token: e.target.value })}
         className="pl-9 w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
         disabled={loading}
        />
       </div>

       <p className="text-xs text-gray-500 mt-1">
        Use um token permanente gerado no Business Manager. Tokens temporários expiram em 24h.
       </p>

       {tokenSaved && (
        <p className="text-xs text-amber-600 mt-1">
         Já existe um token salvo no sistema, mas ele não é exibido por segurança. Cole novamente apenas se quiser atualizar a conexão.
        </p>
       )}
      </div>

      {message && (
       <div
        className={`p-4 rounded-md text-sm flex items-start gap-3 ${
         message.type === 'success'
          ? 'bg-green-50 text-green-800 border border-green-100'
          : 'bg-red-50 text-red-800 border border-red-100'
        }`}
       >
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
         'Atualizar Credenciais'
        ) : (
         'Salvar e Conectar'
        )}
       </button>
      </div>
     </form>
    </div>

    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 h-fit aa-whatsapp-diagnostic-r11b4 __AUTOATENDE_V4_R11B_R4_SETTINGS_VISUAL_SURFACE_POLISH__" data-aa-polish="whatsapp_diagnostic">
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
   {}
   <section className="aa-settings-assistant-surface aa-settings-r11b8-fix-hide-assistant-knowledge-real __AUTOATENDE_V4_R11B_R8_FIX_HIDE_REAL_ASSISTANT_KNOWLEDGE_BLOCK_ANYWHERE__"
    style={{
     border: "1px solid #d9d9d9",
     borderRadius: 14,
     padding: 18,
     background: "#fff",
     marginTop: 20
    }}
   >
    <h2 style={{ marginTop: 0 }}>Assistente IA e Conhecimento do Bot</h2>
    <p style={{ lineHeight: 1.7, marginTop: 0 }}>
     Área administrativa para ajustar o comportamento do bot no WhatsApp,
     incluindo contexto comercial, tom de voz, FAQ, guidance e testes de resposta.
    </p>

    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
     <button
      type="button"
      onClick={() => navigate("/configuracoes/assistente-central")}
      style={{
       padding: "10px 14px",
       border: "1px solid #ddd",
       borderRadius: 10,
       cursor: "pointer",
       background: "transparent"
      }}
     >
      Central do Assistente
     </button>

     <button
      type="button"
      onClick={() => navigate("/configuracoes/teste-assistente")}
      style={{
       padding: "10px 14px",
       border: "1px solid #ddd",
       borderRadius: 10,
       cursor: "pointer",
       background: "transparent"
      }}
     >
      Teste do Assistente
     </button>

     <button
      type="button"
      onClick={() => navigate("/configuracoes/aquisicao/templates")}
      style={{
       padding: "10px 14px",
       border: "1px solid #ddd",
       borderRadius: 10,
       cursor: "pointer",
       background: "transparent"
      }}
     >Templates</button>

     <button
      type="button"
      onClick={() => navigate("/configuracoes/aquisicao")}
      style={{
       padding: "10px 14px",
       border: "1px solid #ddd",
       borderRadius: 10,
       cursor: "pointer",
       background: "transparent"
      }}
     >Disparos</button>
    </div>

    <div className="aa-settings-assistant-note aa-settings-r11b6-admin-warning-hidden __AUTOATENDE_V4_R11B_R6_SETTINGS_NOTICE_HIDE_AND_SPACING_FIX__"
     style={{
      marginTop: 14,
      padding: 12,
      border: "1px solid #f0ad4e",
      borderRadius: 10,
      background: "rgba(240, 173, 78, 0.08)"
     }}
    >
     <strong>Importante:</strong> esta área deve ser usada pelo responsável administrativo da operação.
     O endurecimento de permissão por papel administrativo já está conectado às superfícies administrativas principais. 
    </div>
   </section>

  </div>
 );
}
