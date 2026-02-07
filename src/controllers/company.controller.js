import { getActivePlan } from "../services/company.service.js";

export async function getCompanyPlan(req, res) {
  try {
    const companyId = Number(req.params.companyId);

    if (!companyId) {
      return res.status(400).json({ error: "companyId inválido" });
    }

    const plan = await getActivePlan(companyId);

    if (!plan) {
      return res.status(404).json({ error: "Plano não encontrado" });
    }

    res.json({ plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
}

