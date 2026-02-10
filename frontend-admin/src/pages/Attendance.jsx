import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Bot, RefreshCw, ArrowRightLeft } from 'lucide-react';

const Attendance = () => {
  const { session } = useAuth();
  // Como não temos endpoint de lista de contatos ativos, vamos simular ou extrair das mensagens
  // Para V1, vamos listar mensagens recentes e extrair contatos únicos
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState({}); // Map of contact -> state

  const fetchContactsAndStates = async () => {
    if (!session) return;
    
    try {
      setLoading(true);
      const headers = {
        'Authorization': `Bearer ${session.access_token}`
      };

      // 1. Fetch recent messages to find active contacts
      // Note: This is a workaround since we don't have GET /contacts endpoint
      // Assuming whatsapp routes are also protected or we need to protect them
      // For now, let's assume /api/whatsapp needs auth or is public. 
      // If public, no header needed, but better add it.
      const resMsg = await fetch('/api/whatsapp', { headers }); // Endpoint returns { messages: [] }
      const dataMsg = await resMsg.json();
      
      if (dataMsg.messages) {
        // Extract unique contacts (from or to)
        const uniqueContacts = new Set();
        dataMsg.messages.forEach(m => {
          if (m.from_number) uniqueContacts.add(m.from_number);
          if (m.to_number) uniqueContacts.add(m.to_number);
        });
        // Filter out own number if possible (usually we only want customers)
        // Assuming we don't know own number easily, we list all.
        // Or better, only take 'from_number' of inbound messages? 
        // Let's take all unique numbers that look like phone numbers
        const contactList = Array.from(uniqueContacts).filter(n => n.length > 5);
        
        setContacts(contactList);

        // 2. Fetch state for each contact
        const statesMap = {};
        await Promise.all(contactList.map(async (contact) => {
          try {
            const resState = await fetch(`/api/attendance/state?contact=${contact}`, { headers });
            const dataState = await resState.json();
            if (dataState.success) {
              statesMap[contact] = dataState.data;
            }
          } catch (e) {
            console.warn(`Failed to fetch state for ${contact}`, e);
          }
        }));
        setStates(statesMap);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactsAndStates();
  }, [session]);

  const handleTransfer = async (contact, mode, agentId = null) => {
    try {
      const endpoint = mode === 'human' 
        ? '/api/attendance/transfer/human' 
        : '/api/attendance/return/bot';
      
      const body = {
        contact,
        ...(agentId && { agent_id: agentId })
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        // Refresh state
        const resState = await fetch(`/api/attendance/state?contact=${contact}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const dataState = await resState.json();
        if (dataState.success) {
          setStates(prev => ({ ...prev, [contact]: dataState.data }));
        }
      } else {
        alert('Falha na operação');
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao processar');
    }
  };

  if (loading) return <div className="p-10 text-center">Carregando atendimentos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Atendimento</h2>
          <p className="text-gray-500">Gerencie conversas e transferências</p>
        </div>
        <button 
          onClick={fetchContactsAndStates}
          className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"
        >
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modo Atual</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agente</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-10 text-center text-gray-500">
                  Nenhuma conversa recente encontrada.
                </td>
              </tr>
            ) : (
              contacts.map(contact => {
                const state = states[contact] || { mode: 'bot', assigned_agent_id: null };
                const isHuman = state.mode === 'human';

                return (
                  <tr key={contact}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {contact}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isHuman ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {isHuman ? <User className="w-3 h-3 mr-1"/> : <Bot className="w-3 h-3 mr-1"/>}
                        {state.mode.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {state.assigned_agent_id || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {isHuman ? (
                        <button 
                          onClick={() => handleTransfer(contact, 'bot')}
                          className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                        >
                          <Bot className="w-4 h-4 mr-1" /> Retornar ao Bot
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleTransfer(contact, 'human', 'agent_default')}
                          className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                        >
                          <User className="w-4 h-4 mr-1" /> Transferir p/ Humano
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Attendance;
