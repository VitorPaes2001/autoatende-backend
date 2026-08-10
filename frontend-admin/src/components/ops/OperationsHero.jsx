import React from 'react';

const MARKER = '__AUTOATENDE_C3D1_OPERATIONS_HERO__';

export default function OperationsHero({
  title,
  subtitle,
  chips = []
}) {
  return (
    <div className="aa-ops-hero aa-brand-card p-6 mb-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="aa-brand-kicker">Operação comercial e atendimento</p>
          <h1 className="aa-product-hero-title mt-2">{title}</h1>
          <p className="aa-product-hero-copy mt-3 text-sm">{subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2 lg:max-w-[420px] lg:justify-end">
          {chips.map((chip) => (
            <span key={chip} className="aa-product-pill-neutral">
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="aa-brand-metric p-4">
          <p className="aa-brand-metric-label">Leitura operacional</p>
          <p className="aa-brand-metric-value mt-2 text-sm">
            Menos ruído visual, mais clareza para agir.
          </p>
        </div>

        <div className="aa-brand-metric p-4">
          <p className="aa-brand-metric-label">Contexto</p>
          <p className="aa-brand-metric-value mt-2 text-sm">
            Continuidade entre bot, humano e histórico.
          </p>
        </div>

        <div className="aa-brand-metric p-4">
          <p className="aa-brand-metric-label">Foco</p>
          <p className="aa-brand-metric-value mt-2 text-sm">
            Priorizar atendimento sem perder consistência.
          </p>
        </div>
      </div>

      <span className="hidden">{MARKER}</span>
    </div>
  );
}
