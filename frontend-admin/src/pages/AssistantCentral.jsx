import React from "react";
import { Link } from "react-router-dom";

/* __AUTOATENDE_C3A_ASSISTANT_CENTRAL_PAGE__ */

function Card({ title, description, bullets = [], to, cta }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 14,
        padding: 18,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 22 }}>{title}</h2>
        <p style={{ margin: 0, opacity: 0.8, lineHeight: 1.6 }}>{description}</p>
      </div>

      {bullets.length ? (
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      <div style={{ marginTop: "auto" }}>
        <Link
          to={to}
          style={{
            textDecoration: "none",
            display: "inline-block",
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: "10px 14px",
            color: "inherit",
          }}
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

export default function AssistantCentral() {
  return (
    <div style={{ padding: 24, maxWidth: 1240, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 8 }}>Central do Assistente</h1>
        <p style={{ margin: 0, lineHeight: 1.7 }}>
          Área administrativa para configurar como o bot se comporta no WhatsApp,
          ajustar conhecimento comercial e validar respostas antes de operar em produção.
        </p>
      </div>

      <section
        style={{
          border: "1px solid #f0ad4e",
          borderRadius: 14,
          padding: 16,
          background: "rgba(240, 173, 78, 0.08)",
          marginBottom: 20,
        }}
      >
        <strong>Uso recomendado:</strong>
        <p style={{ margin: "8px 0 0 0", lineHeight: 1.7 }} className="aa-settings-r11b6-admin-warning-hidden __AUTOATENDE_V4_R11B_R6_SETTINGS_NOTICE_HIDE_AND_SPACING_FIX__">
          Esta área deve ser usada pelo responsável administrativo da operação.
          Nesta etapa do projeto a navegação já ficará organizada no painel; o endurecimento
          de permissão por papel administrativo já está alinhado às superfícies administrativas principais. /* __AUTOATENDE_C16N_A2_ASSISTANT_COPY_REFRESH__ */
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          marginBottom: 20,
        }}
      >
        <Card
          title="Onboarding Comercial"
          description="Configuração guiada da empresa para deixar o assistente pronto com mais rapidez."
          bullets={[
            "nome da empresa e público-alvo",
            "contexto comercial",
            "proposta de valor",
            "resumo inteligente e progresso",
          ]}
          to="/configuracoes/onboarding-comercial"
          cta="Abrir onboarding"
        />

        <Card
          title="Perfil Comercial e Conhecimento"
          description="Área para ajustar o conteúdo que o bot usa para responder com mais precisão."
          bullets={[
            "tom de voz",
            "serviços e contexto",
            "tópicos proibidos",
            "FAQ e guidance adicional",
          ]}
          to="/configuracoes/assistente-central"
          cta="Editar conhecimento"
        />

        <Card
          title="Teste do Assistente"
          description="Valide perguntas reais e confira como o assistente está respondendo antes de operar."
          bullets={[
            "preview de respostas",
            "histórico local de testes",
            "presets de perguntas",
            "validação operacional",
          ]}
          to="/configuracoes/teste-assistente"
          cta="Testar agora"
        />
      </div>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 14,
          padding: 18,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Fluxo recomendado de uso</h2>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Configurar ou revisar o contexto da empresa no onboarding.</li>
          <li>Ajustar tom de voz, FAQ e guidance no perfil comercial.</li>
          <li>Ir para o teste do assistente e validar perguntas reais.</li>
          <li>Depois operar no Inbox e acompanhar o comportamento em conversas reais.</li>
        </ol>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <Link
            to="/settings"
            style={{
              textDecoration: "none",
              display: "inline-block",
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: "10px 14px",
              color: "inherit",
            }}
          >
            Voltar para Configurações
          </Link>

          <Link
            to="/inbox"
            style={{
              textDecoration: "none",
              display: "inline-block",
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: "10px 14px",
              color: "inherit",
            }}
          >
            Ir para o Inbox
          </Link>
        </div>
      </section>
    </div>
  );
}
