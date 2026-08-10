import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Bot,
  CheckCheck,
  CreditCard,
  Inbox as InboxIcon,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Send,
  Settings,
  Smile,
  Tag,
  User,
  Users,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import styles from '../styles/InboxV2Preview.module.css';

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    key: 'attendance',
    label: 'Atendimento',
    path: '/attendance',
    icon: MessageSquare,
  },
  {
    key: 'inbox',
    label: 'Inbox 2.0',
    path: '/inbox-v2-preview',
    icon: InboxIcon,
    active: true,
  },
  {
    key: 'leads',
    label: 'Leads',
    path: '/leads',
    icon: Users,
  },
  {
    key: 'billing',
    label: 'Meu Plano',
    path: '/billing',
    icon: CreditCard,
  },
  {
    key: 'campaigns',
    label: 'Disparos',
    path: '/configuracoes/aquisicao',
    icon: Send,
  },
  {
    key: 'settings',
    label: 'Configurações',
    path: '/settings',
    icon: Settings,
  },
];

const EMOJIS = [
  '😀', '😃', '😊', '😉', '😍', '🥰', '😂', '🙏',
  '👍', '👏', '🤝', '💪', '✅', '⭐', '🔥', '🚀',
  '💚', '❤️', '🎉', '💡', '📌', '📞', '📅', '📦',
  '💬', '👀', '✨', '🤗', '😎', '🙌', '👌', '👋',
];

const CONVERSATIONS = [
  {
    id: 'conversation-1',
    name: 'Eleva Fit Meals',
    phone: '5545999999999',
    preview: 'Quero conhecer os planos e funcionalidades.',
    time: '21:44',
    unread: 2,
    mode: 'human',
    label: 'Lead quente',
    tone: 'green',
  },
  {
    id: 'conversation-2',
    name: 'Marmitas Express',
    phone: '5545988888888',
    preview: 'Qual é o valor do plano profissional?',
    time: '15:15',
    unread: 1,
    mode: 'bot',
    label: 'Interesse',
    tone: 'blue',
  },
  {
    id: 'conversation-3',
    name: 'Natália Escocard',
    phone: '5545977777777',
    preview: 'Perfeito, vou testar a plataforma.',
    time: '15:32',
    unread: 0,
    mode: 'human',
    label: 'Cliente',
    tone: 'purple',
  },
  {
    id: 'conversation-4',
    name: 'Healthy Food PR',
    phone: '5545966666666',
    preview: 'Obrigada pelo atendimento!',
    time: '11:30',
    unread: 0,
    mode: 'bot',
    label: 'Nutrição',
    tone: 'amber',
  },
  {
    id: 'conversation-5',
    name: 'Vida Leve Refeições',
    phone: '5545955555555',
    preview: 'Gostaria de marcar uma demonstração.',
    time: '10:18',
    unread: 0,
    mode: 'bot',
    label: 'Demonstração',
    tone: 'green',
  },
];

const INITIAL_MESSAGES = {
  'conversation-1': [
    {
      id: 'message-1',
      direction: 'inbound',
      sender: 'Cliente',
      text:
        'Oi! Gostaria de saber mais sobre os planos e ' +
        'funcionalidades.',
      time: '21:44',
    },
    {
      id: 'message-2',
      direction: 'outbound',
      sender: 'AutoAtendeAI',
      text:
        'Claro! A AutoAtendeAI oferece uma operação completa ' +
        'para atendimento pelo WhatsApp.\n\n' +
        'Você pode centralizar conversas, usar IA com contexto, ' +
        'transferir para o atendimento humano e acompanhar toda ' +
        'a operação em um único painel.',
      time: '21:45',
    },
    {
      id: 'message-3',
      direction: 'outbound',
      sender: 'AutoAtendeAI',
      text: 'Qual área você gostaria de conhecer primeiro? 😊',
      time: '21:45',
    },
  ],
  'conversation-2': [
    {
      id: 'message-4',
      direction: 'inbound',
      sender: 'Cliente',
      text: 'Qual é o valor do plano profissional?',
      time: '15:15',
    },
    {
      id: 'message-5',
      direction: 'outbound',
      sender: 'AutoAtendeAI',
      text:
        'O plano Profissional começa em R$ 449,90 por mês.',
      time: '15:16',
    },
  ],
  'conversation-3': [
    {
      id: 'message-6',
      direction: 'inbound',
      sender: 'Cliente',
      text: 'Perfeito, vou testar a plataforma.',
      time: '15:32',
    },
  ],
  'conversation-4': [
    {
      id: 'message-7',
      direction: 'inbound',
      sender: 'Cliente',
      text: 'Obrigada pelo atendimento!',
      time: '11:30',
    },
  ],
  'conversation-5': [
    {
      id: 'message-8',
      direction: 'inbound',
      sender: 'Cliente',
      text: 'Gostaria de marcar uma demonstração.',
      time: '10:18',
    },
  ],
};

function cx(...classNames) {
  return classNames.filter(Boolean).join(' ');
}

function getInitials(name = '') {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return 'CT';
  }

  return parts
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function getCurrentTime() {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function InboxV2Preview() {
  const auth = useAuth();

  const [selectedId, setSelectedId] = useState(
    CONVERSATIONS[0].id
  );

  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [
    messagesByConversation,
    setMessagesByConversation,
  ] = useState(INITIAL_MESSAGES);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  const selectedConversation =
    CONVERSATIONS.find(
      (conversation) => conversation.id === selectedId
    ) ?? CONVERSATIONS[0];

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    if (!normalizedSearch) {
      return CONVERSATIONS;
    }

    return CONVERSATIONS.filter((conversation) => {
      return (
        conversation.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        conversation.phone.includes(normalizedSearch)
      );
    });
  }, [search]);

  const selectedMessages =
    messagesByConversation[selectedId] ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      block: 'end',
    });
  }, [selectedId, selectedMessages.length]);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '42px';
    textarea.style.height =
      `${Math.min(textarea.scrollHeight, 118)}px`;
  };

  const insertEmoji = (emoji) => {
    const textarea = textareaRef.current;

    const selectionStart =
      textarea?.selectionStart ?? draft.length;

    const selectionEnd =
      textarea?.selectionEnd ?? selectionStart;

    const nextDraft =
      draft.slice(0, selectionStart) +
      emoji +
      draft.slice(selectionEnd);

    setDraft(nextDraft);

    window.requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }

      const nextCursor =
        selectionStart + emoji.length;

      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        nextCursor,
        nextCursor
      );

      resizeTextarea();
    });
  };

  const submitMessage = (event) => {
    event.preventDefault();

    const text = draft.trim();

    if (!text) {
      return;
    }

    const nextMessage = {
      id: `local-${Date.now()}`,
      direction: 'outbound',
      sender: 'Você',
      text,
      time: getCurrentTime(),
    };

    setMessagesByConversation((current) => ({
      ...current,
      [selectedId]: [
        ...(current[selectedId] ?? []),
        nextMessage,
      ],
    }));

    setDraft('');
    setEmojiOpen(false);

    window.requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }

      textareaRef.current.style.height = '42px';
      textareaRef.current.focus();
    });
  };

  const openNavigationItem = (item) => {
    if (item.active) {
      return;
    }

    window.open(
      item.path,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleLogout = async () => {
    if (typeof auth?.signOut === 'function') {
      await auth.signOut();
      return;
    }

    window.location.assign('/login');
  };

  return (
    <div
      className={cx(
        styles.root,
        detailsOpen && styles.detailsOpen
      )}
    >
      <div
        className={styles.rail}
        role="navigation"
        aria-label="Menu principal"
      >
        <div
          className={styles.brand}
          title="AutoAtendeAI"
          aria-label="AutoAtendeAI"
        >
          <MessageSquare aria-hidden="true" />
        </div>

        <div className={styles.navigation}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                type="button"
                className={cx(
                  styles.navButton,
                  item.active && styles.navActive
                )}
                onClick={() =>
                  openNavigationItem(item)
                }
                title={
                  item.active
                    ? item.label
                    : `${item.label} — abrir em nova aba`
                }
                aria-label={item.label}
                aria-current={
                  item.active ? 'page' : undefined
                }
              >
                <Icon aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className={styles.logoutButton}
          onClick={handleLogout}
          title="Sair"
          aria-label="Sair"
        >
          <LogOut aria-hidden="true" />
        </button>
      </div>

      <div className={styles.conversationPanel}>
        <header className={styles.conversationHeader}>
          <div>
            <span>Atendimento</span>
            <h1>Conversas</h1>
          </div>

          <button
            type="button"
            className={styles.iconButton}
            title="Mais opções"
            aria-label="Mais opções"
          >
            <MoreVertical aria-hidden="true" />
          </button>
        </header>

        <div className={styles.search}>
          <Search aria-hidden="true" />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Buscar conversa"
          />
        </div>

        <div className={styles.filters}>
          <button
            type="button"
            className={styles.filterActive}
          >
            Todas
            <span>21</span>
          </button>

          <button type="button">
            Não lidas
            <span>3</span>
          </button>

          <button type="button">
            Minhas
            <span>1</span>
          </button>
        </div>

        <div className={styles.conversationList}>
          {filteredConversations.map((conversation) => {
            const isSelected =
              selectedId === conversation.id;

            return (
              <button
                type="button"
                key={conversation.id}
                className={cx(
                  styles.conversation,
                  isSelected &&
                    styles.conversationSelected
                )}
                onClick={() => {
                  setSelectedId(conversation.id);
                  setEmojiOpen(false);
                }}
              >
                <div
                  className={cx(
                    styles.avatar,
                    styles[
                      `avatar_${conversation.tone}`
                    ]
                  )}
                >
                  {getInitials(conversation.name)}
                </div>

                <div className={styles.conversationCopy}>
                  <div
                    className={styles.conversationTitle}
                  >
                    <strong>
                      {conversation.name}
                    </strong>

                    <time>{conversation.time}</time>
                  </div>

                  <p>{conversation.preview}</p>

                  <div
                    className={styles.conversationMeta}
                  >
                    <span
                      className={cx(
                        styles.mode,
                        conversation.mode === 'human'
                          ? styles.modeHuman
                          : styles.modeBot
                      )}
                    >
                      {conversation.mode === 'human' ? (
                        <User aria-hidden="true" />
                      ) : (
                        <Bot aria-hidden="true" />
                      )}

                      {conversation.mode === 'human'
                        ? 'Humano'
                        : 'Bot'}
                    </span>

                    <span className={styles.tag}>
                      {conversation.label}
                    </span>

                    {conversation.unread > 0 ? (
                      <span className={styles.unread}>
                        {conversation.unread}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <main className={styles.chat}>
        <header className={styles.chatHeader}>
          <div className={styles.chatContact}>
            <div
              className={cx(
                styles.avatar,
                styles[
                  `avatar_${selectedConversation.tone}`
                ]
              )}
            >
              {getInitials(selectedConversation.name)}
            </div>

            <div>
              <h2>{selectedConversation.name}</h2>

              <span>
                {selectedConversation.phone}
                {' · '}
                Responsável: Você
              </span>
            </div>
          </div>

          <div className={styles.chatActions}>
            <span
              className={cx(
                styles.mode,
                selectedConversation.mode === 'human'
                  ? styles.modeHuman
                  : styles.modeBot
              )}
            >
              {selectedConversation.mode === 'human' ? (
                <User aria-hidden="true" />
              ) : (
                <Bot aria-hidden="true" />
              )}

              {selectedConversation.mode === 'human'
                ? 'Humano'
                : 'Bot'}
            </span>

            <button
              type="button"
              className={styles.headerButton}
            >
              <Tag aria-hidden="true" />
              {selectedConversation.label}
            </button>

            <button
              type="button"
              className={cx(
                styles.iconButton,
                detailsOpen && styles.iconButtonActive
              )}
              onClick={() =>
                setDetailsOpen((current) => !current)
              }
              title="Informações do contato"
              aria-label="Informações do contato"
              aria-expanded={detailsOpen}
            >
              {detailsOpen ? (
                <PanelRightClose aria-hidden="true" />
              ) : (
                <PanelRightOpen aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              className={styles.iconButton}
              title="Mais opções"
              aria-label="Mais opções"
            >
              <MoreVertical aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className={styles.messages}>
          <div className={styles.dayMarker}>
            Hoje
          </div>

          {selectedMessages.map((message) => (
            <div
              key={message.id}
              className={cx(
                styles.messageRow,
                message.direction === 'outbound'
                  ? styles.messageRowOutbound
                  : styles.messageRowInbound
              )}
            >
              <article
                className={cx(
                  styles.message,
                  message.direction === 'outbound'
                    ? styles.messageOutbound
                    : styles.messageInbound
                )}
              >
                <span>{message.sender}</span>

                <p>{message.text}</p>

                <footer>
                  <time>{message.time}</time>

                  {message.direction === 'outbound' ? (
                    <CheckCheck
                      aria-label="Mensagem enviada"
                    />
                  ) : null}
                </footer>
              </article>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </section>

        <form
          className={styles.composer}
          onSubmit={submitMessage}
        >
          <div className={styles.composerBox}>
            {emojiOpen ? (
              <div className={styles.emojiPicker}>
                <header>
                  <span>Emojis</span>

                  <button
                    type="button"
                    onClick={() =>
                      setEmojiOpen(false)
                    }
                  >
                    Fechar
                  </button>
                </header>

                <div>
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onMouseDown={(event) =>
                        event.preventDefault()
                      }
                      onClick={() =>
                        insertEmoji(emoji)
                      }
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className={cx(
                styles.emojiButton,
                emojiOpen && styles.emojiButtonActive
              )}
              onClick={() =>
                setEmojiOpen((current) => !current)
              }
              title="Emojis"
              aria-label="Emojis"
            >
              <Smile aria-hidden="true" />
            </button>

            <textarea
              ref={textareaRef}
              value={draft}
              rows={1}
              placeholder="Digite uma mensagem"
              onChange={(event) => {
                setDraft(event.target.value);
                resizeTextarea();
              }}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();

                  if (draft.trim()) {
                    event.currentTarget.form?.requestSubmit();
                  }
                }
              }}
            />

            <button
              type="submit"
              className={styles.sendButton}
              disabled={!draft.trim()}
              title="Enviar"
              aria-label="Enviar"
            >
              <Send aria-hidden="true" />
            </button>
          </div>
        </form>
      </main>

      {detailsOpen ? (
        <div
          className={styles.details}
          role="complementary"
          aria-label="Informações do contato"
        >
          <header className={styles.detailsHeader}>
            <h2>Informações do contato</h2>

            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setDetailsOpen(false)}
              title="Fechar informações"
              aria-label="Fechar informações"
            >
              <PanelRightClose aria-hidden="true" />
            </button>
          </header>

          <section className={styles.contactSummary}>
            <div
              className={cx(
                styles.avatar,
                styles.avatarLarge,
                styles[
                  `avatar_${selectedConversation.tone}`
                ]
              )}
            >
              {getInitials(selectedConversation.name)}
            </div>

            <strong>
              {selectedConversation.name}
            </strong>

            <span>
              {selectedConversation.phone}
            </span>
          </section>

          <section className={styles.detailsSection}>
            <h3>Sobre o contato</h3>

            <dl>
              <div>
                <dt>Primeira conversa</dt>
                <dd>17/05/2026</dd>
              </div>

              <div>
                <dt>Última mensagem</dt>
                <dd>Agora há pouco</dd>
              </div>

              <div>
                <dt>Mensagens</dt>
                <dd>{selectedMessages.length}</dd>
              </div>

              <div>
                <dt>Responsável</dt>
                <dd>Você</dd>
              </div>
            </dl>
          </section>

          <section className={styles.detailsSection}>
            <h3>Etiquetas</h3>

            <div className={styles.detailTags}>
              <span>Cliente</span>
              <span>Interesse</span>
              <span>Nutrição</span>
              <button type="button">+</button>
            </div>
          </section>

          <section className={styles.detailsSection}>
            <h3>Prévia isolada</h3>

            <p className={styles.detailsNote}>
              Esta versão ainda utiliza dados locais e não
              altera conversas reais.
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default InboxV2Preview;
