import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, Search, Send } from 'lucide-react';

function extractText(message) {
  return (
    message?.content ||
    message?.body ||
    message?.text_body ||
    message?.text?.body ||
    ''
  );
}

function isOutbound(message) {
  if (message?.direction) return message.direction === 'outbound';
  if (typeof message?.from_me === 'boolean') return message.from_me;
  return false;
}

const Inbox = () => {
  const { session } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }), [session]);

  const fetchConversations = async (searchQuery = '') => {
    if (!session?.access_token) return;
    setLoadingList(true);

    try {
      const query = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const res = await fetch(`/api/inbox/conversations${query}`, { headers });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setConversations(list);

      if (!selectedConversation?.id && list.length > 0) {
        setSelectedConversation(list[0]);
      } else if (selectedConversation?.id) {
        const updated = list.find((item) => item.id === selectedConversation.id);
        if (updated) setSelectedConversation(updated);
      }
    } catch (error) {
      console.error('Erro ao carregar conversas', error);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    if (!session?.access_token || !conversationId) return;
    setLoadingThread(true);

    try {
      const res = await fetch(`/api/inbox/conversations/${conversationId}/messages`, { headers });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar mensagens', error);
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    fetchConversations('');
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchConversations(search);
  }, [search]);

  useEffect(() => {
    if (selectedConversation?.id) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  const onSend = async (event) => {
    event.preventDefault();

    if (!draft.trim() || !selectedConversation?.id || sending) return;

    setSending(true);
    const text = draft.trim();

    try {
      const res = await fetch(`/api/inbox/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error('Falha ao enviar mensagem');
      }

      setDraft('');
      await fetchMessages(selectedConversation.id);
      await fetchConversations(search);
    } catch (error) {
      console.error(error);
      alert('Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Inbox</h2>
          <p className="text-gray-500">Conversas em tempo real por WhatsApp</p>
        </div>
        <button
          onClick={() => fetchConversations(search)}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white lg:col-span-1">
          <div className="border-b border-gray-200 p-3">
            <label className="flex items-center rounded-md border border-gray-300 px-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full border-0 px-2 py-2 text-sm focus:outline-none"
                placeholder="Buscar nome ou telefone"
              />
            </label>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {loadingList ? (
              <p className="p-4 text-sm text-gray-500">Carregando conversas...</p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Nenhuma conversa encontrada.</p>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${selectedConversation?.id === conversation.id ? 'bg-blue-50' : ''}`}
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {conversation.contact_name || conversation.contact_number || 'Sem contato'}
                  </p>
                  <p className="text-xs text-gray-500">{conversation.contact_number || '-'}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Modo: {conversation.mode || 'bot'}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="flex h-[70vh] flex-col rounded-lg border border-gray-200 bg-white lg:col-span-2">
          <div className="border-b border-gray-200 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">
              {selectedConversation?.contact_name || selectedConversation?.contact_number || 'Selecione uma conversa'}
            </p>
            <p className="text-xs text-gray-500">{selectedConversation?.contact_number || ''}</p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-4">
            {!selectedConversation ? (
              <p className="text-sm text-gray-500">Selecione uma conversa para ver a thread.</p>
            ) : loadingThread ? (
              <p className="text-sm text-gray-500">Carregando mensagens...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-gray-500">Sem mensagens nesta conversa.</p>
            ) : (
              messages.map((message) => {
                const outbound = isOutbound(message);
                return (
                  <div key={message.id || `${message.created_at}-${extractText(message)}`} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                    <div className={`${outbound ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'} max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm`}>
                      <p>{extractText(message) || '[mensagem sem texto]'}</p>
                      <p className={`mt-1 text-[10px] ${outbound ? 'text-blue-100' : 'text-gray-400'}`}>
                        {message.created_at ? new Date(message.created_at).toLocaleString('pt-BR') : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={onSend} className="border-t border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Digite uma mensagem"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim() || !selectedConversation}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="mr-2 h-4 w-4" /> Enviar
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Inbox;
