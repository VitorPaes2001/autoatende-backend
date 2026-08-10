/* __AUTOATENDE_V4_R6C_DISPAROS_COMMERCIAL_COPY_ALIGNMENT__ */
/* __AUTOATENDE_C5B1_R3_SETTINGS_SHELL__ */
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import RoleGuard from "../components/auth/RoleGuard";
import { resolveCurrentRole } from "../lib/roleAccess";
import WhatsAppConnect from "../components/WhatsAppConnect";

import { Link } from 'react-router-dom';
import GuidedActivationJourneyCard from '../components/settings/GuidedActivationJourneyCard';
import AgentSeatGovernanceCard from '../components/settings/AgentSeatGovernanceCard';
import AgentSeatCapacityGuard from "../components/AgentSeatCapacityGuard.jsx";

import AgentSeatCapacityInitialRefreshBridge from "../components/AgentSeatCapacityInitialRefreshBridge.jsx";
import AgentCreateFormGuard from "../components/AgentCreateFormGuard.jsx";

import AgentSeatStatusInline from "../components/AgentSeatStatusInline"; // __AUTOATENDE_V4_R12B_R2_FIX_FRONTEND_AGENT_SEAT_STATUS_PANEL__
import SettingsOpsSummaryCleaner from "../components/SettingsOpsSummaryCleaner"; // __AUTOATENDE_V4_R12B_R3_HIDE_REDUNDANT_OPS_SUMMARY_FROM_SETTINGS__

const emptyForm = {
  name: "",
  email: ""
};

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

const SettingsPage = () => {
  const { user, session, resolvedRole: authResolvedRole } = useAuth();

  const explicitSettingsRole =
    user?.role ||
    user?.user_metadata?.role ||
    user?.app_metadata?.role ||
    session?.user?.role ||
    session?.user?.user_metadata?.role ||
    session?.user?.app_metadata?.role ||
    null;

  const settingsResolvedRole = explicitSettingsRole
    ? resolveCurrentRole(explicitSettingsRole)
    : (authResolvedRole || null);

  const canManageAgents =
    settingsResolvedRole === "company" ||
    settingsResolvedRole === "owner" ||
    settingsResolvedRole === "admin";

  const denyAdminAction = (text = "Esta ação exige perfil administrativo da empresa.") => {
    setMessage({
      type: "error",
      text
    });
    return false;
  };

  const [agents, setAgents] = useState([]);
  /* __AUTOATENDE_C16N_C16D_AGENT_CREATE_PATH_PRECHECK_AND_LIMIT_GUARD_POLISH_STATE__ */
  const [agentSeatGuard, setAgentSeatGuard] = useState({
    loading: true,
    rawPlan: '',
    planLabel: '',
    limit: null,
    used: 0,
    remaining: null,
    isAtLimit: false,
    isNearLimit: false,
    source: '',
  });
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [form, setForm] = useState(emptyForm);
  
const [message, setMessage] = useState(null);
  const [agentReassignModal, setAgentReassignModal] = useState({
    open: false,
    submitting: false,
    sourceAgent: null,
    sourceAgentId: "",
    sourceAgentLabel: "",
    options: [],
    targetId: "",
    assignedCount: 0,
    error: ""
  });
  const [agentDeleteModal, setAgentDeleteModal] = useState({
    open: false,
    submitting: false,
    agent: null,
    agentId: "",
    agentLabel: "",
    assignedCount: 0,
    guardOk: true,
    error: ""
  });
  const [createdAgent, setCreatedAgent] = useState(null);

  /* __AUTOATENDE_C8B_R4B_SETTINGS_OPS_SUMMARY_STATE__ */
  const [opsSummary, setOpsSummary] = useState({
    loading: false,
    error: '',
    registeredAgents: 0,
    totalConversations: 0,
    humanConversations: 0,
    assignedConversations: 0,
    unassignedConversations: 0,
    updatedAt: ''
  });

  /* __AUTOATENDE_C8B_R4C_SETTINGS_AGENT_DISTRIBUTION_STATE__ */
  const [opsAgentDistribution, setOpsAgentDistribution] = useState({
    loading: false,
    items: []
  });

  const authHeaders = useMemo(() => {
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [session?.access_token]);

  const fetchAgents = async () => {
    if (!session?.access_token) return;

    if (!canManageAgents) {
        setLoadingAgents(false);
        return;
      }

      try {
      setLoadingAgents(true);

      const response = await fetch("/api/users/agents", {
        headers: {
          ...authHeaders
        }
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Falha ao carregar agentes.");
      }

      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      setAgents(rows.filter((row) => row?.role !== "company"));
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text: error.message || "Erro ao carregar agentes."
      });
    } finally {
      setLoadingAgents(false);
    }
  };

  /* __AUTOATENDE_C8B_R4B_SETTINGS_OPS_SUMMARY_LOADER__ */
  const loadOpsSummary = async () => {
    if (!session?.access_token) return;

    if (!canManageAgents) return;

      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

    try {
      /* __AUTOATENDE_C8B_R4C_SETTINGS_AGENT_DISTRIBUTION_LOADER__ */
      setOpsAgentDistribution((prev) => ({
        ...prev,
        loading: true
      }));

      setOpsSummary((prev) => ({
        ...prev,
        loading: true,
        error: ''
      }));

      const [agentsRes, conversationsRes] = await Promise.all([
        fetch('/api/users/agents', { headers: authHeaders }),
        fetch('/api/inbox/conversations', { headers: authHeaders })
      ]);

      const agentsPayload = await agentsRes.json().catch(() => ({}));
      const conversationsPayload = await conversationsRes.json().catch(() => ({}));

      const agents = Array.isArray(agentsPayload?.data)
        ? agentsPayload.data
        : Array.isArray(agentsPayload)
          ? agentsPayload
          : [];

      const conversations = Array.isArray(conversationsPayload?.data)
        ? conversationsPayload.data
        : Array.isArray(conversationsPayload)
          ? conversationsPayload
          : [];

      const firstDefined = (...values) => {
        for (const value of values) {
          if (value === undefined || value === null) continue;
          if (typeof value === 'string' && value.trim() === '') continue;
          return value;
        }
        return null;
      };

      const extractMode = (conversation) => {
        const raw = firstDefined(
          conversation?.current_mode,
          conversation?.mode,
          conversation?.status,
          conversation?.raw?.current_mode,
          conversation?.raw?.mode,
          conversation?.raw?.status
        );

        const normalized = String(raw || 'bot').trim().toLowerCase();
        return normalized.includes('human') || normalized.includes('humano') ? 'human' : 'bot';
      };

      const extractOwnerId = (conversation) =>
        firstDefined(
          conversation?.resolved_owner_id,
          conversation?.assigned_user_id,
          conversation?.assignedAgentId,
          conversation?.assigned_agent_id,
          conversation?.ownerId,
          conversation?.owner_id,
          conversation?.agentId,
          conversation?.agent_id,
          conversation?.userId,
          conversation?.user_id,
          conversation?.raw?.resolved_owner_id,
          conversation?.raw?.assigned_user_id,
          conversation?.raw?.assigned_agent_id,
          conversation?.raw?.owner_id
        );

      let humanConversations = 0;
      let assignedConversations = 0;
      let unassignedConversations = 0;

      for (const conversation of conversations) {
        const mode = extractMode(conversation);
        if (mode !== 'human') continue;

        humanConversations += 1;
        const ownerId = extractOwnerId(conversation);
        if (ownerId) assignedConversations += 1;
        else unassignedConversations += 1;
      }

      const distributionMap = new Map();

      for (const agent of agents) {
        const agentId = firstDefined(agent?.id, agent?.user_id, agent?.userId);
        if (!agentId) continue;

        distributionMap.set(String(agentId), {
          id: String(agentId),
          name: firstDefined(agent?.name, agent?.full_name, agent?.email, 'Agente'),
          email: firstDefined(agent?.email, ''),
          human_count: 0
        });
      }

      for (const conversation of conversations) {
        const mode = extractMode(conversation);
        if (mode !== 'human') continue;

        const ownerId = extractOwnerId(conversation);
        if (!ownerId) continue;

        const normalizedOwnerId = String(ownerId);
        const existing = distributionMap.get(normalizedOwnerId) || {
          id: normalizedOwnerId,
          name: 'Agente',
          email: '',
          human_count: 0
        };

        existing.human_count += 1;
        distributionMap.set(normalizedOwnerId, existing);
      }

      const distributionItems = Array.from(distributionMap.values())
        .filter((item) => item.human_count > 0)
        .sort((a, b) => {
          if ((b.human_count || 0) !== (a.human_count || 0)) {
            return (b.human_count || 0) - (a.human_count || 0);
          }
          return String(a.name || '').localeCompare(String(b.name || ''));
        });

      setOpsSummary({
        loading: false,
        error: '',
        registeredAgents: agents.length,
        totalConversations: conversations.length,
        humanConversations,
        assignedConversations,
        unassignedConversations,
        updatedAt: new Date().toLocaleTimeString('pt-BR')
      });

      setOpsAgentDistribution({
        loading: false,
        items: distributionItems
      });
    } catch (error) {
      console.error('Failed to load ops summary bridge', error);
      setOpsSummary((prev) => ({
        ...prev,
        loading: false,
        error: 'Não foi possível atualizar o resumo operacional agora.'
      }));

      setOpsAgentDistribution((prev) => ({
        ...prev,
        loading: false
      }));
    }
  };

  useEffect(() => {
      if (!canManageAgents) return;
      loadOpsSummary();
    }, [session?.access_token, canManageAgents]);


  useEffect(() => {
      if (!canManageAgents) return;
      fetchAgents();
    }, [session?.access_token, canManageAgents]);

  const openCreateModal = () => {
    if (!canManageAgents) {
      denyAdminAction("A criação de agentes exige perfil administrativo.");
      return;
    }
    setForm(emptyForm);
    setCreatedAgent(null);
    setMessage(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (creatingAgent) return;
    setShowCreateModal(false);
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!canManageAgents) {
        denyAdminAction("A criação de agentes exige perfil administrativo.");
        return;
      }

      setCreatingAgent(true);
    setMessage(null);
    setCreatedAgent(null);

    try {
      const payloadToSend = {
        name: String(form.name || "").trim(),
        email: String(form.email || "").trim().toLowerCase()
      };

      if (!payloadToSend.name || !payloadToSend.email) {
        throw new Error("Preencha nome e email do agente.");
      }

      const response = await fetch("/api/users/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify(payloadToSend)
      });

      const payload = await response.json();

      if (!response.ok) {
        const code = payload?.code || "";
        let errorText = payload?.userMessage || payload?.error || payload?.message || "Não foi possível criar o agente.";

        if (code === "USER_EMAIL_ALREADY_EXISTS") {
          errorText = "Já existe um usuário com este e-mail no sistema.";
        }

        if (code === "AGENT_LIMIT_EXCEEDED") {
          errorText =
            payload?.userMessage ||
            "Seu plano atual atingiu o limite de agentes. Faça upgrade para adicionar mais usuários internos.";
        }

        /* __AUTOATENDE_C11A_R3E_SETTINGS_AGENT_LIMIT_UX__ */ else if (code === "LIMIT_EXCEEDED") {
          errorText = "Seu plano atingiu o limite de agentes. Faça upgrade para adicionar mais.";
        } else if ((payload?.details || "").includes("email")) {
          errorText = payload.details;
        }

        throw new Error(errorText);
      }

      setCreatedAgent({
        ...(payload?.data || {}),
        temporary_password: payload?.temporary_password || null
      });

      setMessage({
        type: "success",
        text: "Agente criado com sucesso."
      });

      setForm(emptyForm);
        await Promise.allSettled([fetchAgents(), loadOpsSummary()]);
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text: error.message || "Erro ao criar agente."
      });
    } finally {
      setCreatingAgent(false);
    }
  };

  
  /* __AUTOATENDE_C8C_R1_AGENT_DELETE_GUARD_HELPER__ */
  const __aaC8cFirstDefined = (...values) => {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && value.trim() === '') continue;
      return value;
    }
    return null;
  };

  const __aaC8cExtractMode = (conversation = {}) => {
    const raw = __aaC8cFirstDefined(
      conversation?.current_mode,
      conversation?.mode,
      conversation?.status,
      conversation?.raw?.current_mode,
      conversation?.raw?.mode,
      conversation?.raw?.status
    );

    const normalized = String(raw || 'bot').trim().toLowerCase();
    return normalized.includes('human') || normalized.includes('humano') ? 'human' : 'bot';
  };

  const __aaC8cExtractOwnerId = (conversation = {}) =>
    __aaC8cFirstDefined(
      conversation?.resolved_owner_id,
      conversation?.assigned_user_id,
      conversation?.assignedAgentId,
      conversation?.assigned_agent_id,
      conversation?.ownerId,
      conversation?.owner_id,
      conversation?.agentId,
      conversation?.agent_id,
      conversation?.userId,
      conversation?.user_id,
      conversation?.raw?.resolved_owner_id,
      conversation?.raw?.assigned_user_id,
      conversation?.raw?.assigned_agent_id,
      conversation?.raw?.owner_id
    );

  const __aaC8cCountAssignedHumanForAgent = async (candidateAgent) => {
    if (!session?.access_token) {
      return { ok: false, count: 0, reason: 'missing_session' };
    }

    const targetId = String(
      __aaC8cFirstDefined(
        candidateAgent?.id,
        candidateAgent?.user_id,
        candidateAgent?.userId,
        candidateAgent
      ) || ''
    ).trim();

    if (!targetId) {
      return { ok: false, count: 0, reason: 'missing_agent_id' };
    }

    try {
      const response = await fetch('/api/inbox/conversations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { ok: false, count: 0, reason: 'fetch_not_ok', payload };
      }

      const conversations = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

      let count = 0;

      for (const conversation of conversations) {
        const mode = __aaC8cExtractMode(conversation);
        if (mode !== 'human') continue;

        const ownerId = __aaC8cExtractOwnerId(conversation);
        if (!ownerId) continue;

        if (String(ownerId) === targetId) {
          count += 1;
        }
      }

      return { ok: true, count };
    } catch (error) {
      console.error('C8C-R1 delete guard failed while checking assigned human conversations', error);
      return { ok: false, count: 0, reason: 'fetch_failed' };
    }
  };


  /* __AUTOATENDE_C16M_C1B_AGENT_REASSIGN_MODAL__ */
const closeAgentReassignModal = () => {
  if (agentReassignModal.submitting) return;
  setAgentReassignModal({
    open: false,
    submitting: false,
    sourceAgent: null,
    sourceAgentId: "",
    sourceAgentLabel: "",
    options: [],
    targetId: "",
    assignedCount: 0,
    error: ""
  });
};

const __aaC8cStartReassignFlow = async (candidateAgent, meta = {}) => {
  if (!canManageAgents) {
    denyAdminAction("A reatribuição de carga humana exige perfil administrativo.");
    return { ok: false, reason: "forbidden_role" };
  }

  if (!session?.access_token) {
    setMessage({
      type: "error",
      text: "Sessão inválida para reatribuição administrativa."
    });
    return { ok: false, reason: "missing_session" };
  }

  const sourceAgentId = String(
    __aaC8cFirstDefined(
      candidateAgent?.id,
      candidateAgent?.user_id,
      candidateAgent?.userId,
      candidateAgent
    ) || ""
  ).trim();

  const sourceAgentLabel = __aaC8cFirstDefined(
    candidateAgent?.name,
    candidateAgent?.email,
    sourceAgentId
  );

  if (!sourceAgentId) {
    setMessage({
      type: "error",
      text: "Não foi possível identificar o agente de origem para reatribuição."
    });
    return { ok: false, reason: "missing_source_agent_id" };
  }

  try {
    const agentsResponse = await fetch("/api/users/agents", {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    const agentsPayload = await agentsResponse.json().catch(() => ({}));

    if (!agentsResponse.ok) {
      const errorText = String(
        agentsPayload?.error ||
        agentsPayload?.message ||
        "Não foi possível carregar a lista de agentes agora."
      ).trim();

      setMessage({
        type: "error",
        text: errorText || "Não foi possível carregar a lista de agentes agora."
      });

      return { ok: false, reason: "agents_fetch_not_ok", payload: agentsPayload };
    }

    const agents = Array.isArray(agentsPayload?.data)
      ? agentsPayload.data
      : Array.isArray(agentsPayload)
        ? agentsPayload
        : [];

    const options = agents
      .map((item) => {
        const id = String(
          __aaC8cFirstDefined(item?.id, item?.user_id, item?.userId) || ""
        ).trim();

        return {
          id,
          name: __aaC8cFirstDefined(item?.name, ""),
          email: __aaC8cFirstDefined(item?.email, ""),
          label: [
            __aaC8cFirstDefined(item?.name, ""),
            __aaC8cFirstDefined(item?.email, "")
          ]
            .filter(Boolean)
            .join(" — ")
        };
      })
      .filter((item) => item.id && item.id !== sourceAgentId);

    if (!options.length) {
      setMessage({
        type: "error",
        text: "Não existe outro agente elegível para receber a carga humana neste momento."
      });
      return { ok: false, reason: "no_target_agents" };
    }

    const defaultTarget =
      options.find((item) => item.id === String(meta?.preferredTargetId || "").trim()) ||
      options[0];

    setAgentReassignModal({
      open: true,
      submitting: false,
      sourceAgent: candidateAgent || null,
      sourceAgentId,
      sourceAgentLabel: String(sourceAgentLabel || sourceAgentId),
      options,
      targetId: defaultTarget?.id || "",
      assignedCount: Number(meta?.assignedCount || 0),
      error: ""
    });

    return { ok: true, opened: true, optionsCount: options.length };
  } catch (error) {
    console.error("C16M-C1B-R2 reassign modal bootstrap failed", error);
    setMessage({
      type: "error",
      text: "Não foi possível iniciar a reatribuição administrativa agora."
    });
    return { ok: false, reason: "reassign_bootstrap_failed" };
  }
};

const confirmAgentReassign = async () => {
  if (!canManageAgents) {
    denyAdminAction("A reatribuição de carga humana exige perfil administrativo.");
    return;
  }

  if (!session?.access_token) {
    setAgentReassignModal((prev) => ({
      ...prev,
      error: "Sessão inválida para reatribuição administrativa."
    }));
    return;
  }

  const sourceAgentId = String(agentReassignModal.sourceAgentId || "").trim();
  const targetId = String(agentReassignModal.targetId || "").trim();
  const target = agentReassignModal.options.find((item) => item.id === targetId);

  if (!sourceAgentId) {
    setAgentReassignModal((prev) => ({
      ...prev,
      error: "Não foi possível identificar o agente de origem."
    }));
    return;
  }

  if (!targetId || !target) {
    setAgentReassignModal((prev) => ({
      ...prev,
      error: "Selecione um agente de destino válido."
    }));
    return;
  }

  setAgentReassignModal((prev) => ({
    ...prev,
    submitting: true,
    error: ""
  }));

  try {
    const response = await fetch(`/api/users/agents/${sourceAgentId}/reassign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        target_agent_id: target.id
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorText = String(
        payload?.error ||
        payload?.message ||
        "Não foi possível reatribuir a carga humana agora."
      ).trim();

      setAgentReassignModal((prev) => ({
        ...prev,
        submitting: false,
        error: errorText || "Não foi possível reatribuir a carga humana agora."
      }));
      return;
    }

    const reassignedCount = Number(
      payload?.reassigned_count ??
      payload?.data?.reassigned_count ??
      0
    );

    setAgentReassignModal({
      open: false,
      submitting: false,
      sourceAgent: null,
      sourceAgentId: "",
      sourceAgentLabel: "",
      options: [],
      targetId: "",
      assignedCount: 0,
      error: ""
    });

    setMessage({
      type: "success",
      text: `Reatribuição concluída. ${reassignedCount} conversa(s) humana(s) foram movidas para ${target.label || target.id}.`
    });

    await Promise.allSettled([fetchAgents(), loadOpsSummary()]);
  } catch (error) {
    console.error("C16M-C1B-R2 reassign submit failed", error);
    setAgentReassignModal((prev) => ({
      ...prev,
      submitting: false,
      error: "Não foi possível concluir a reatribuição administrativa agora."
    }));
  }
};

/* __AUTOATENDE_C16M_C1B_AGENT_DELETE_MODAL__ */
const closeAgentDeleteModal = () => {
  if (agentDeleteModal.submitting) return;
  setAgentDeleteModal({
    open: false,
    submitting: false,
    agent: null,
    agentId: "",
    agentLabel: "",
    assignedCount: 0,
    guardOk: true,
    error: ""
  });
};

const handleDeleteAgent = async (candidateAgent) => {
  if (!canManageAgents) {
    denyAdminAction("A exclusão de agentes exige perfil administrativo.");
    return;
  }

  const targetId = String(
    __aaC8cFirstDefined(
      candidateAgent?.id,
      candidateAgent?.user_id,
      candidateAgent?.userId,
      candidateAgent
    ) || ""
  ).trim();

  const targetLabel = __aaC8cFirstDefined(
    candidateAgent?.name,
    candidateAgent?.email,
    targetId
  );

  if (!session?.access_token) {
    setMessage({
      type: "error",
      text: "Sessão inválida para exclusão de agente."
    });
    return;
  }

  if (!targetId) {
    setMessage({
      type: "error",
      text: "Não foi possível identificar o agente a ser excluído."
    });
    return;
  }

  setMessage(null);

  const deleteGuard = await __aaC8cCountAssignedHumanForAgent(candidateAgent);

  setAgentDeleteModal({
    open: true,
    submitting: false,
    agent: candidateAgent || null,
    agentId: targetId,
    agentLabel: String(targetLabel || targetId),
    assignedCount: deleteGuard?.ok ? Number(deleteGuard.count || 0) : 0,
    guardOk: Boolean(deleteGuard?.ok),
    error: deleteGuard?.ok
      ? ""
      : "Não foi possível validar automaticamente a carga humana deste agente. Revise a operação antes de concluir a exclusão."
  });
};

const continueDeleteWithReassign = async () => {
  const candidateAgent = agentDeleteModal.agent;
  const assignedCount = Number(agentDeleteModal.assignedCount || 0);

  if (!candidateAgent) {
    setAgentDeleteModal((prev) => ({
      ...prev,
      error: "Não foi possível identificar o agente para iniciar a reatribuição."
    }));
    return;
  }

  const result = await __aaC8cStartReassignFlow(candidateAgent, {
    assignedCount
  });

  if (result?.ok) {
    setAgentDeleteModal({
      open: false,
      submitting: false,
      agent: null,
      agentId: "",
      agentLabel: "",
      assignedCount: 0,
      guardOk: true,
      error: ""
    });
  }
};

const confirmDeleteAgent = async () => {
  if (!canManageAgents) {
    denyAdminAction("A exclusão de agentes exige perfil administrativo.");
    return;
  }

  if (!session?.access_token) {
    setAgentDeleteModal((prev) => ({
      ...prev,
      error: "Sessão inválida para exclusão de agente."
    }));
    return;
  }

  const targetId = String(agentDeleteModal.agentId || "").trim();
  const targetLabel = String(agentDeleteModal.agentLabel || targetId).trim();

  if (!targetId) {
    setAgentDeleteModal((prev) => ({
      ...prev,
      error: "Não foi possível identificar o agente a ser excluído."
    }));
    return;
  }

  if (Number(agentDeleteModal.assignedCount || 0) > 0) {
    setAgentDeleteModal((prev) => ({
      ...prev,
      error: "Reatribua ou retorne essas conversas ao bot antes de excluir o agente."
    }));
    return;
  }

  setDeletingAgentId(targetId);
  setAgentDeleteModal((prev) => ({
    ...prev,
    submitting: true,
    error: ""
  }));

  try {
    const response = await fetch(`/api/users/agents/${targetId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage = String(
        payload?.error ||
        payload?.message ||
        "Não foi possível excluir o agente agora."
      ).trim();

      setAgentDeleteModal((prev) => ({
        ...prev,
        submitting: false,
        error: errorMessage || "Não foi possível excluir o agente agora."
      }));
      return;
    }

    const successMessage = String(
      payload?.message ||
      `Agente ${targetLabel} excluído com sucesso.`
    ).trim();

    setAgentDeleteModal({
      open: false,
      submitting: false,
      agent: null,
      agentId: "",
      agentLabel: "",
      assignedCount: 0,
      guardOk: true,
      error: ""
    });

    setMessage({
      type: "success",
      text: successMessage || `Agente ${targetLabel} excluído com sucesso.`
    });

    await Promise.allSettled([fetchAgents(), loadOpsSummary()]);
  } catch (error) {
    console.error("C16M-C1B-R2 delete submit failed", error);
    setAgentDeleteModal((prev) => ({
      ...prev,
      submitting: false,
      error: "Não foi possível concluir a exclusão do agente agora."
    }));
  } finally {
    setDeletingAgentId(null);
  }
};

  return (
    <div className="aa-page-shell aa-settings-shell aa-settings-hub-r11b space-y-6 __AUTOATENDE_V4_R11B_R1_SETTINGS_HUB_PREMIUM_STRUCTURE__ aa-settings-clean-first-r11b2 __AUTOATENDE_V4_R11B_R3_HIDE_REAL_OPERATIONAL_SURFACES_IN_SETTINGS__ ">
      {/* __AUTOATENDE_C16N_C16B_AGENT_SEAT_MANAGEMENT_PHASE1__ */}
      <AgentSeatGovernanceCard agents={agents} canManageAgents={canManageAgents} onSeatStatusChange={setAgentSeatGuard} />
      {/* __AUTOATENDE_C16N_C16D_AGENT_CREATE_PATH_PRECHECK_AND_LIMIT_GUARD_POLISH_VIEW__ */}
      {canManageAgents && !agentSeatGuard.loading && agentSeatGuard.isAtLimit ? (
        <div className="aa-brand-warning p-4 mb-6" data-aa-seat-guard="limit">
          <p className="aa-brand-copy text-sm font-semibold">
            Seu plano {agentSeatGuard.planLabel || 'atual'} atingiu o limite de agentes ({agentSeatGuard.used}/{agentSeatGuard.limit}). Faça upgrade antes de adicionar mais usuários internos.
          </p>
        </div>
      ) : null}
      {canManageAgents && !agentSeatGuard.loading && !agentSeatGuard.isAtLimit && agentSeatGuard.isNearLimit ? (
        <div className="aa-brand-subcard p-4 mb-6" data-aa-seat-guard="near-limit">
          <p className="aa-brand-copy text-sm">
            Atenção: o plano {agentSeatGuard.planLabel || 'atual'} está no último seat disponível ({agentSeatGuard.used}/{agentSeatGuard.limit}). Vale preparar o upgrade antes de consumir a capacidade restante.
          </p>
        </div>
      ) : null}
        {/* __AUTOATENDE_C16N_C13B_GUIDED_ACTIVATION_ORCHESTRATION__ */}
        <GuidedActivationJourneyCard />
      <div className="aa-page-hero aa-settings-hero aa-settings-main-hero-r11b7 __AUTOATENDE_V4_R11B_R7_SETTINGS_FINAL_VISUAL_ALIGNMENT__">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Configurações</h2>

        <div
          data-marker="__AUTOATENDE_C16N_C5C_SETTINGS_SHORTCUTS__"
          className="rounded-2xl border border-[rgba(148,163,184,0.16)] bg-[rgba(15,23,42,0.55)] p-5 mb-6"
         style={{ display: 'none' }}>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-100">Assistente e Disparos</h3>
            <p className="mt-1 text-sm text-slate-400">
              Acessos internos do painel para Central do Assistente, Preview e Disparos, sem navegação paralela.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 aa-settings-assistant-knowledge-r11b4 __AUTOATENDE_V4_R11B_R4_SETTINGS_VISUAL_SURFACE_POLISH__" data-aa-polish="assistant_knowledge">
            <Link
              to="/configuracoes/assistente-central"
              className="inline-flex min-h-[38px] items-center rounded-xl border border-[rgba(148,163,184,0.18)] bg-[rgba(2,8,23,0.52)] px-4 text-sm font-semibold text-slate-200 transition hover:border-[rgba(52,211,153,0.45)] hover:text-white"
            >
              Central do Assistente
            </Link>

            <Link
              to="/configuracoes/teste-assistente"
              className="inline-flex min-h-[38px] items-center rounded-xl border border-[rgba(148,163,184,0.18)] bg-[rgba(2,8,23,0.52)] px-4 text-sm font-semibold text-slate-200 transition hover:border-[rgba(52,211,153,0.45)] hover:text-white"
            >
              Teste do Assistente
            </Link>

            <Link
              to="/configuracoes/aquisicao"
              className="inline-flex min-h-[38px] items-center rounded-xl border border-[rgba(148,163,184,0.18)] bg-[rgba(2,8,23,0.52)] px-4 text-sm font-semibold text-slate-200 transition hover:border-[rgba(52,211,153,0.45)] hover:text-white"
            >
              Disparos
            </Link>
          </div>
        </div>


          <a
            to="/configuracoes/aquisicao"
            className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
           style={{ display: 'none' }}>
            Abrir disparos do site
          </a>
        </div>
        <p className="text-gray-500">Gerencie conexão oficial do WhatsApp e agentes internos</p>
      </div>

      <section className="aa-settings-hub-r11b-grid" aria-label="Hub de Configurações" data-aa-marker="__AUTOATENDE_V4_R11B_R1_SETTINGS_HUB_PREMIUM_STRUCTURE__">
        <div className="aa-settings-hub-r11b-card aa-settings-hub-r11b-card--primary">
          <p className="aa-settings-hub-r11b-kicker">Assistente de IA</p>
          <h3>Central do Assistente</h3>
          <p>Configure identidade, comportamento, conhecimento e regras comerciais do assistente.</p>
          <div className="aa-settings-hub-r11b-actions">
            <Link to="/configuracoes/assistente-central">Abrir central</Link>
            <Link to="/configuracoes/teste-assistente">Testar resposta</Link>
          </div>
        </div>

        <div className="aa-settings-hub-r11b-card">
          <p className="aa-settings-hub-r11b-kicker">Operação humana</p>
          <h3>Equipe e atendimento</h3>
          <p>Gerencie agentes, acompanhe operação humana e mantenha o atendimento organizado.</p>
          <div className="aa-settings-hub-r11b-actions">
            <a href="#gestao-agentes">Gerenciar agentes</a>
            <Link to="/attendance">Abrir atendimento</Link>
          </div>
        </div>

        <div className="aa-settings-hub-r11b-card">
          <p className="aa-settings-hub-r11b-kicker">Disparos</p>
          <h3>Campanhas e templates</h3>
          <p>Acompanhe envios, listas, templates e saldo operacional de mensagens.</p>
          <div className="aa-settings-hub-r11b-actions">
            <Link to="/configuracoes/aquisicao">Abrir disparos</Link>
            <Link to="/configuracoes/aquisicao/templates">Templates</Link>
          </div>
        </div>

        <div className="aa-settings-hub-r11b-card">
          <p className="aa-settings-hub-r11b-kicker">Conta e plano</p>
          <h3>Assinatura</h3>
          <p>Revise plano, limites, franquias e configurações comerciais da conta.</p>
          <div className="aa-settings-hub-r11b-actions">
            <Link to="/billing">Meu plano</Link>
          </div>
        </div>
      </section>


      {message && (
        <div
          className={`p-4 rounded-lg border text-sm flex items-start gap-3 ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 aa-settings-company-card aa-settings-company-info-r11b4 __AUTOATENDE_V4_R11B_R4_SETTINGS_VISUAL_SURFACE_POLISH__" data-aa-polish="company_info">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Informações da Empresa</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Admin</label>
            <div className="mt-1 p-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-600 font-mono break-all">
              {user?.email || "-"}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">User ID</label>
            <div className="mt-1 p-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-600 font-mono break-all">
              {user?.id || "-"}
            </div>
          </div>
        </div>
      </div>

      <WhatsAppConnect />

      <RoleGuard
          allowed={['company', 'admin', 'owner']}
          userRole={settingsResolvedRole}
          title="Gestão de agentes restrita"
          description="A criação, reatribuição e exclusão de agentes exige perfil administrativo da empresa."
        >
<div id="gestao-agentes" className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 aa-settings-agents-panel aa-settings-ops-agents-r11b4 __AUTOATENDE_V4_R11B_R4_SETTINGS_VISUAL_SURFACE_POLISH__ aa-settings-agents-table-r11b4" data-aa-polish="ops_summary_agents">
        <div className="mb-4 rounded-2xl border border-sky-200/20 bg-white/5 p-4 shadow-sm aa-settings-ops-summary-panel">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              Resumo operacional leve
            </div>
            <div className="mt-1 text-lg font-bold text-white">
              Indicadores rápidos da operação humana
            </div>
            <p className="mt-2 text-sm text-sky-100/80">
              Supervisão administrativa com atualização isolada, sem mexer na fila crítica do Atendimento.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-sky-100/70">
              {opsSummary.loading
                ? 'Atualizando resumo...'
                : opsSummary.updatedAt
                  ? `Última atualização: ${opsSummary.updatedAt}`
                  : 'Resumo ainda não carregado'}
            </div>

            <button
              type="button"
              onClick={() => { loadOpsSummary(); }}
              className="rounded-full border border-sky-200/20 px-3 py-1 text-xs font-medium text-sky-100 transition hover:bg-white/5"
            >
              Atualizar resumo
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5 aa-settings-ops-summary-grid">
          <div className="rounded-xl border border-sky-200/15 bg-black/10 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-sky-300">Agentes cadastrados</div>
            <div className="mt-2 text-2xl font-bold text-white">{opsSummary.registeredAgents}</div>
          </div>

          <div className="rounded-xl border border-sky-200/15 bg-black/10 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-sky-300">Conversas totais</div>
            <div className="mt-2 text-2xl font-bold text-white">{opsSummary.totalConversations}</div>
          </div>

          <div className="rounded-xl border border-sky-200/15 bg-black/10 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-sky-300">Humanas</div>
            <div className="mt-2 text-2xl font-bold text-white">{opsSummary.humanConversations}</div>
          </div>

          <div className="rounded-xl border border-sky-200/15 bg-black/10 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-sky-300">Atribuídas</div>
            <div className="mt-2 text-2xl font-bold text-white">{opsSummary.assignedConversations}</div>
          </div>

          <div className="rounded-xl border border-sky-200/15 bg-black/10 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-sky-300">Sem responsável</div>
            <div className="mt-2 text-2xl font-bold text-white">{opsSummary.unassignedConversations}</div>
          </div>
        </div>

        {opsSummary.error ? (
          <div className="mt-3 rounded-xl border border-amber-200/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {opsSummary.error}
          </div>
        ) : null}
      </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 aa-settings-agents-header">
            <div>
              {/* __AUTOATENDE_V4_R12B_R2_FIX_FRONTEND_AGENT_SEAT_STATUS_PANEL__ */}
                            {/* __AUTOATENDE_V4_R12B_R3_HIDE_REDUNDANT_OPS_SUMMARY_FROM_SETTINGS__ */}
              <SettingsOpsSummaryCleaner />
      {/* __AUTOATENDE_V4_R12B_R8_SETTINGS_RENDER_AGENT_SEAT_GUARD__ */}
      <AgentSeatCapacityGuard />
      {/* __AUTOATENDE_V4_R12B_R8D_RENDER_CAPACITY_INITIAL_REFRESH_BRIDGE__ */}
      <AgentSeatCapacityInitialRefreshBridge />
      {/* __AUTOATENDE_V4_R12C_R3_RENDER_ADD_AGENT_FORM_GUARD__ */}
      <AgentCreateFormGuard />
<AgentSeatStatusInline />
              <h3 className="text-lg font-semibold text-gray-800">Agentes de Atendimento</h3>
              <p className="text-sm text-gray-500">
                Crie usuários internos para atendimento humano e operação da plataforma.
              </p>
            </div>

            <div className="flex gap-2 aa-settings-agents-toolbar">
              <button
                onClick={fetchAgents}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2 aa-settings-toolbar-btn aa-settings-toolbar-btn--secondary"
                type="button"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </button>

              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 inline-flex items-center gap-2 aa-settings-toolbar-btn aa-settings-toolbar-btn--primary"
                type="button"
              >
                <Plus className="w-4 h-4" />
                Adicionar Agente
              </button>
            </div>
          </div>

{loadingAgents ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : agents.length === 0 ? (
          <div className="p-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center">
            <UserPlus className="w-8 h-8 mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 font-medium">Nenhum agente cadastrado ainda.</p>
            <p className="text-xs text-gray-500 mt-1">
              Use o botão acima para criar o primeiro agente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto aa-settings-agents-table-wrap">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Perfil</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado em</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {agents.map((agent) => {
                  const isDeleting = deletingAgentId === agent.id;

                  return (
                    <tr key={agent.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {agent.name || "-"}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {agent.email || "-"}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-700 uppercase">
                          {agent.role || "-"}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDateTime(agent.created_at)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          type="button"
                          onClick={() => handleDeleteAgent(agent)}
                          disabled={isDeleting}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
                            isDeleting
                              ? "border-gray-200 text-gray-400 cursor-not-allowed"
                              : "border-red-200 text-red-600 hover:bg-red-50"
                          }`}
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </RoleGuard>

        {/* __AUTOATENDE_C16M_B1_R3_AGENTS_FRONTEND_HARDENING__ */}
  {/* __AUTOATENDE_C16M_C1B_AGENT_DELETE_MODAL_UI__ */}
  {agentDeleteModal.open && canManageAgents && (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-gray-100">
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Excluir agente</h3>
            <p className="text-sm text-gray-500 mt-1">
              Revise a carga humana antes de concluir esta ação.
            </p>
          </div>

          <button
            type="button"
            onClick={closeAgentDeleteModal}
            className="text-gray-400 hover:text-gray-600"
            disabled={agentDeleteModal.submitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Você está gerenciando a exclusão de <strong className="font-semibold">{agentDeleteModal.agentLabel || "agente"}</strong>.
          </div>

          {!agentDeleteModal.guardOk && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Não foi possível validar automaticamente a carga humana deste agente. Revise a operação antes de concluir a exclusão.
            </div>
          )}

          {Number(agentDeleteModal.assignedCount || 0) > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Este agente possui <strong className="font-semibold">{agentDeleteModal.assignedCount}</strong> conversa(s) humana(s) atribuída(s). Reatribua essa carga antes de concluir a exclusão.
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Nenhuma conversa humana atribuída foi identificada neste momento. A exclusão removerá o agente da operação humana.
            </div>
          )}

          {agentDeleteModal.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {agentDeleteModal.error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeAgentDeleteModal}
              className="px-4 py-2.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={agentDeleteModal.submitting}
            >
              Cancelar
            </button>

            {Number(agentDeleteModal.assignedCount || 0) > 0 ? (
              <button
                type="button"
                onClick={continueDeleteWithReassign}
                className="px-5 py-2.5 rounded-md text-white bg-blue-600 hover:bg-blue-700"
                disabled={agentDeleteModal.submitting}
              >
                Reatribuir agora
              </button>
            ) : (
              <button
                type="button"
                onClick={confirmDeleteAgent}
                disabled={agentDeleteModal.submitting}
                className={`px-5 py-2.5 rounded-md text-white inline-flex items-center justify-center gap-2 ${
                  agentDeleteModal.submitting ? "bg-red-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {agentDeleteModal.submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Excluir agente"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )}

  {/* __AUTOATENDE_C16M_C1B_AGENT_REASSIGN_MODAL_UI__ */}
  {agentReassignModal.open && canManageAgents && (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl border border-gray-100">
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Reatribuir carga humana</h3>
            <p className="text-sm text-gray-500 mt-1">
              Escolha o agente de destino para assumir a operação humana.
            </p>
          </div>

          <button
            type="button"
            onClick={closeAgentReassignModal}
            className="text-gray-400 hover:text-gray-600"
            disabled={agentReassignModal.submitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Reatribua as conversas humanas de <strong className="font-semibold">{agentReassignModal.sourceAgentLabel || "agente selecionado"}</strong> para outro agente elegível.
            {Number(agentReassignModal.assignedCount || 0) > 0 ? (
              <span> Carga atual identificada: <strong className="font-semibold">{agentReassignModal.assignedCount}</strong> conversa(s) humana(s).</span>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agente de destino
            </label>

            <select
              value={agentReassignModal.targetId}
              onChange={(e) =>
                setAgentReassignModal((prev) => ({
                  ...prev,
                  targetId: e.target.value,
                  error: ""
                }))
              }
              className="w-full border border-gray-300 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={agentReassignModal.submitting}
            >
              {agentReassignModal.options.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label || item.id}
                </option>
              ))}
            </select>

            <p className="text-xs text-gray-500 mt-2">
              A reatribuição usa a rota administrativa já existente e atualiza o resumo operacional ao final.
            </p>
          </div>

          {agentReassignModal.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {agentReassignModal.error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeAgentReassignModal}
              className="px-4 py-2.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={agentReassignModal.submitting}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={confirmAgentReassign}
              disabled={agentReassignModal.submitting || !agentReassignModal.targetId}
              className={`px-5 py-2.5 rounded-md text-white inline-flex items-center justify-center gap-2 ${
                agentReassignModal.submitting || !agentReassignModal.targetId
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {agentReassignModal.submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reatribuindo...
                </>
              ) : (
                "Confirmar reatribuição"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )}



      {showCreateModal && canManageAgents && (

        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100">
            <div className="flex items-start justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-2xl font-semibold text-gray-800">Criar novo agente</h3>
                <p className="text-sm text-gray-500 mt-1">
                  O sistema gerará uma senha temporária automaticamente.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={creatingAgent}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do agente
                </label>
                <input
                  type="text"
                  placeholder="Ex.: João Atendimento"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creatingAgent}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email do agente
                </label>
                <input
                  type="email"
                  placeholder="agente@empresa.com"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creatingAgent}
                  required
                />
              </div>

              {createdAgent?.temporary_password && (
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <div className="w-full">
                      <p className="font-semibold">Senha temporária gerada</p>
                      <p className="text-sm mt-1">
                        Salve isso agora no seu arquivo <strong>CHAVES PROJETO</strong>. Essa é a credencial inicial do agente.
                      </p>
                      <div className="mt-3 bg-white border border-amber-200 rounded-md px-4 py-3 font-mono text-sm break-all">
                        {createdAgent.temporary_password}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={creatingAgent}
                >
                  Fechar
                </button>

                <button
                  type="submit"
                  disabled={creatingAgent}
                  className={`px-5 py-2.5 rounded-md text-white inline-flex items-center gap-2 ${
                    creatingAgent ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {creatingAgent ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Criar agente
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;


/* __AUTOATENDE_C16M_B1_R5_AGENTS_FRONTEND_COMPLETION__ */
