import './styles.css';

const credibilitySignals = [
  {
    title: 'BOT ↔ HUMANO no mesmo fluxo',
    text: 'A operação não fica quebrada entre automação e atendimento humano.'
  },
  {
    title: 'Contexto comercial por empresa',
    text: 'A IA responde com base nas regras, postura e direcionamento do negócio.'
  },
  {
    title: 'Ativação guiada no app',
    text: 'A entrada do cliente no produto já segue uma jornada mais clara e operacional.'
  },
  {
    title: 'Dashboard operacional inicial',
    text: 'A empresa já começa a ganhar leitura executiva da operação e da distribuição.'
  }
];

const pillars = [
  {
    title: 'Estrutura, não improviso',
    description:
      'O WhatsApp deixa de depender de esforço manual espalhado e passa a operar com contexto, critérios e continuidade.'
  },
  {
    title: 'IA útil para o negócio',
    description:
      'A automação não fica genérica. O comportamento do assistente acompanha a realidade comercial da empresa.'
  },
  {
    title: 'Escala com mais controle',
    description:
      'A operação consegue crescer com mais previsibilidade, melhor distribuição e mais visão do atendimento.'
  }
];

const flow = [
  {
    step: '01',
    title: 'Entrada e triagem',
    text: 'A conversa entra em um fluxo estruturado desde o primeiro contato.'
  },
  {
    step: '02',
    title: 'Qualificação com contexto',
    text: 'A IA conduz a primeira camada e identifica quando deve aprofundar ou transbordar.'
  },
  {
    step: '03',
    title: 'Transbordo sem ruptura',
    text: 'Quando precisa de humano, a continuidade da conversa é preservada.'
  },
  {
    step: '04',
    title: 'Operação mais visível',
    text: 'A empresa ganha mais leitura da carga, do atendimento e do canal.'
  }
];

const fitCases = [
  'Empresas que já usam WhatsApp como canal central de entrada',
  'Operações que querem responder melhor sem cair em improviso',
  'Times que precisam organizar BOT, humano, contexto e continuidade',
  'Negócios que querem crescer sem transformar atendimento em caos'
];

const plans = [
  {
    name: 'Essencial',
    price: 'R$ 249,90',
    agents: '1 agente',
    highlight: 'Para começar a estruturar o canal com controle operacional.',
    items: [
      'Operação no WhatsApp com IA + humano',
      '1 agente',
      '100 mensagens marketing',
      '600 utility/authentication'
    ]
  },
  {
    name: 'Profissional',
    price: 'R$ 449,90',
    agents: '4 agentes',
    highlight: 'Para operações que já precisam distribuir melhor a demanda e ganhar escala.',
    featured: true,
    items: [
      'Tudo do plano Essencial',
      '4 agentes',
      '250 mensagens marketing',
      '1.500 utility/authentication',
      'Mais controle de atendimento e performance'
    ]
  },
  {
    name: 'Business',
    price: 'R$ 699,90',
    agents: '8 agentes',
    highlight: 'Para empresas com operação mais intensa e necessidade maior de capacidade.',
    items: [
      'Tudo do plano Profissional',
      '8 agentes',
      '500 mensagens marketing',
      '3.000 utility/authentication'
    ]
  }
];

const faq = [
  {
    question: 'A AutoAtendeAI substitui o atendimento humano?',
    answer:
      'Não. A proposta é estruturar a operação para combinar IA e atendimento humano no mesmo fluxo, com critérios mais claros de transbordo e continuidade.'
  },
  {
    question: 'Serve só para responder mensagens?',
    answer:
      'Não. O ponto central é dar mais organização operacional ao WhatsApp da empresa, incluindo contexto comercial, distribuição e acompanhamento do canal.'
  },
  {
    question: 'Faz sentido para qualquer empresa?',
    answer:
      'Faz mais sentido quando o WhatsApp já é canal relevante de comercial, suporte ou relacionamento e a falta de estrutura começa a travar qualidade e escala.'
  }
];

const footerLinks = [
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Para quem', href: '#para-quem' },
  { label: 'Planos', href: '#planos' },
  { label: 'Contato', href: '#contato' },
  { label: 'Termos de uso', href: '/termos/' },
  { label: 'Privacidade', href: '/privacidade/' }
];

export default function App() {
  const year = new Date().getFullYear();

  return (
    <div className="site-shell">
      <header className="nav">
        <div className="container nav-inner">
          <a href="/" className="brand" aria-label="AutoAtendeAI">
            <img src="/logo-autoatende-header.webp" alt="AutoAtendeAI" className="brand-logo" />
            <span>AutoAtendeAI</span>
          </a>

          <nav className="nav-links" aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#para-quem">Para quem</a>
            <a href="#planos">Planos</a>
          </nav>

          <div className="nav-actions">
            <a href="/go/app/?src=nav_app" className="nav-main-cta">
              Entrar no app
            </a>
            <a href="/go/whatsapp/?src=nav_whatsapp" className="nav-cta">
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">Agente de IA operacional + atendimento humano</div>
              <h1>Estruture o WhatsApp da sua empresa para vender, atender e operar com mais controle.</h1>
              <p>
                A AutoAtendeAI organiza o canal para combinar IA, contexto comercial e operação humana no mesmo fluxo.
                O resultado é uma operação mais clara, mais profissional e mais preparada para crescer.
              </p>

              <div className="hero-actions">
                <a href="/go/whatsapp/?src=hero_whatsapp" className="button button-primary">
                  Solicitar demonstração
                </a>
                <a href="/go/app/?src=hero_app" className="button button-secondary">
                  Conhecer o produto
                </a>
              </div>

              <div className="hero-proof">
                <span>WhatsApp com mais contexto</span>
                <span>Operação com mais continuidade</span>
                <span>Escala com mais controle</span>
              </div>
            </div>

            <div className="hero-side-grid">
              {credibilitySignals.map((item) => (
                <article key={item.title} className="signal-card">
                  <div className="signal-dot" />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-tight">
          <div className="container credibility-strip">
            <div className="credibility-chip">IA + humano no mesmo fluxo</div>
            <div className="credibility-chip">Configuração comercial por empresa</div>
            <div className="credibility-chip">Ativação guiada e leitura operacional</div>
          </div>
        </section>

        <section className="section" id="como-funciona">
          <div className="container">
            <div className="section-heading">
              <div className="eyebrow">Como a AutoAtendeAI entra na operação</div>
              <h2>Não é só responder mais rápido. É operar o canal com mais estrutura.</h2>
              <p>
                A diferença não está em um chatbot genérico. Está em transformar o WhatsApp em um canal mais organizado,
                com contexto, transbordo claro e continuidade entre automação e atendimento humano.
              </p>
            </div>

            <div className="pillars-grid">
              {pillars.map((item) => (
                <article key={item.title} className="card">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>

            <div className="flow-grid">
              {flow.map((item) => (
                <article key={item.step} className="flow-card">
                  <span className="flow-step">{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-soft">
          <div className="container credibility-grid-shell">
            <div className="section-heading">
              <div className="eyebrow">Credibilidade operacional</div>
              <h2>O valor não está só na promessa. Está na estrutura que já sustenta a operação.</h2>
              <p>
                A base do produto já foi organizada para ativação, configuração do assistente, leitura operacional e
                continuidade do atendimento. Isso reduz improviso e deixa o canal mais vendável internamente.
              </p>
            </div>

            <div className="credibility-grid">
              {credibilitySignals.map((item) => (
                <article key={item.title} className="card card-compact">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-soft" id="para-quem">
          <div className="container fit-grid">
            <div className="section-heading">
              <div className="eyebrow">Para quem faz mais sentido</div>
              <h2>Empresas que já sentem o WhatsApp como parte central da operação</h2>
              <p>
                A proposta faz mais sentido quando o canal já impacta comercial, suporte ou relacionamento e a falta de
                estrutura começa a travar velocidade, qualidade e escala.
              </p>
            </div>

            <div className="card">
              <div className="fit-list">
                {fitCases.map((item) => (
                  <div key={item} className="fit-item">
                    <span className="fit-bullet" />
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="planos">
          <div className="container">
            <div className="section-heading">
              <div className="eyebrow">Planos</div>
              <h2>Estrutura comercial clara para diferentes estágios da operação</h2>
              <p>
                Os planos acompanham capacidade operacional, quantidade de agentes e franquia mensal de mensagens.
              </p>
            </div>

            <div className="plans-grid">
              {plans.map((plan) => (
                <article key={plan.name} className={`plan-card${plan.featured ? ' featured' : ''}`}>
                  <div className="plan-top">
                    <div>
                      <div className="plan-name">{plan.name}</div>
                      <div className="plan-price-row">
                        <div className="plan-price">{plan.price}</div>
                        <div className="plan-cycle">/mês</div>
                      </div>
                      <div className="plan-agents">{plan.agents}</div>
                    </div>
                    {plan.featured ? <span className="plan-badge">Mais indicado</span> : null}
                  </div>

                  <p className="plan-highlight">{plan.highlight}</p>

                  <div className="plan-list">
                    {plan.items.map((item) => (
                      <div key={item} className="plan-item">
                        <span className="fit-bullet" />
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="plan-note">
              <p>
                Valores mensais. A composição final da contratação, franquias, limites operacionais, add-ons e condições
                comerciais é formalizada no processo comercial e contratual.
              </p>
            </div>
          </div>
        </section>

        <section className="section section-soft">
          <div className="container">
            <div className="section-heading">
              <div className="eyebrow">Perguntas frequentes</div>
              <h2>O tipo de dúvida que normalmente aparece antes de uma decisão comercial</h2>
            </div>

            <div className="faq-grid">
              {faq.map((item) => (
                <article key={item.question} className="card card-compact">
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-soft" id="contato">
          <div className="container">
            <div className="section-heading">
              <div className="eyebrow">Contato comercial e próximos passos</div>
              <h2>O melhor próximo passo é enquadrar a operação certa antes de ativar.</h2>
              <p>
                O contato comercial precisa deixar claro como a conversa começa: entender o cenário, definir o
                enquadramento mais coerente e ativar a estrutura com critério.
              </p>
            </div>

            <div className="legal-grid">
              <article className="card card-compact">
                <h3>Contato comercial</h3>
                <p>
                  Para demonstração, entendimento da operação e enquadramento do plano mais coerente, o canal principal é
                  o contato direto com a AutoAtendeAI.
                </p>
                <div className="legal-actions">
                  <a href="/go/whatsapp/?src=legal_whatsapp" className="button button-primary">
                    Falar no WhatsApp
                  </a>
                  <a href="/go/app/?src=legal_app" className="button button-secondary">
                    Entrar no app
                  </a>
                </div>
              </article>

              <article className="card card-compact">
                <h3>Como a conversa comercial começa</h3>
                <div className="fit-list">
                  <div className="fit-item">
                    <span className="fit-bullet" />
                    <p>Entender o cenário atual da operação e onde o WhatsApp já pesa no comercial ou atendimento.</p>
                  </div>
                  <div className="fit-item">
                    <span className="fit-bullet" />
                    <p>Definir o enquadramento mais coerente de plano, capacidade e início de estruturação.</p>
                  </div>
                  <div className="fit-item">
                    <span className="fit-bullet" />
                    <p>Avançar para ativação inicial com mais clareza de fluxo, contexto e próximos passos.</p>
                  </div>
                </div>
              </article>

              <article className="card card-compact">
                <h3>Clareza comercial e institucional</h3>
                <div className="fit-list">
                  <div className="fit-item">
                    <span className="fit-bullet" />
                    <p>Os planos exibidos no site são referências mensais.</p>
                  </div>
                  <div className="fit-item">
                    <span className="fit-bullet" />
                    <p>O enquadramento final depende da realidade operacional e do processo comercial.</p>
                  </div>
                  <div className="fit-item">
                    <span className="fit-bullet" />
                    <p>Termos de uso e privacidade já estão disponíveis em páginas dedicadas.</p>
                  </div>
                </div>
                <div className="legal-links-row">
                  <a href="/termos/" className="button button-secondary button-small">
                    Ler termos completos
                  </a>
                  <a href="/privacidade/" className="button button-secondary button-small">
                    Ver privacidade
                  </a>
                </div>
              </article>
            </div>

            <div className="legal-note">
              <p>
                Esta página apresenta uma base comercial e institucional objetiva. A intenção aqui é facilitar a decisão
                inicial com mais clareza sobre contato, mensalidade, enquadramento e documentação de apoio.
              </p>
            </div>
          </div>
        </section>

        <section className="section cta-section">
          <div className="container cta-shell">
            <div>
              <div className="eyebrow">Próximo passo</div>
              <h2>Se o WhatsApp já pesa na operação, o próximo passo é enquadrar a estrutura certa.</h2>
              <p>
                A conversa comercial serve para entender o cenário, alinhar a referência mensal mais coerente e definir
                uma ativação inicial com mais critério.
              </p>
              <div className="cta-proof hero-proof">
                <span>Entendimento da operação</span>
                <span>Enquadramento do plano</span>
                <span>Ativação inicial</span>
              </div>
            </div>

            <div className="cta-actions">
              <a href="/go/whatsapp/?src=cta_whatsapp" className="button button-primary">
                Falar com a AutoAtendeAI
              </a>
              <a href="/go/app/?src=cta_app" className="button button-secondary">
                Conhecer o app
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <div className="brand footer-brand-inline">
              <img src="/logo-autoatende-header.webp" alt="AutoAtendeAI" className="brand-logo" />
              <span>AutoAtendeAI</span>
            </div>
            <p>
              Estruturação operacional do WhatsApp com IA, contexto comercial e atendimento humano no mesmo fluxo.
            </p>
          </div>

          <div className="footer-col">
            <h3>Navegação</h3>
            <div className="footer-links">
              {footerLinks.slice(0, 4).map((item) => (
                <a key={item.label} href={item.href}>
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div className="footer-col">
            <h3>Institucional</h3>
            <div className="footer-links">
              {footerLinks.slice(4).map((item) => (
                <a key={item.label} href={item.href}>
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div className="footer-col">
            <h3>Contato</h3>
            <div className="footer-links">
              <a href="/go/whatsapp/?src=footer_whatsapp">WhatsApp comercial</a>
              <a href="/go/app/?src=footer_app">Conhecer o app</a>
              <a href="https://autoatendeai.com.br">Site institucional</a>
              <a href="https://app.autoatendeai.com.br">Ambiente do cliente</a>
            </div>
          </div>
        </div>

        <div className="container footer-bottom">
          <p>© {year} AutoAtendeAI. Todos os direitos reservados.</p>
          <p>Planos e valores apresentados no site correspondem à referência mensal.</p>
        </div>
      </footer>
    </div>
  );
}
