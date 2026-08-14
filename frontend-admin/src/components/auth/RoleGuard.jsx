import React from 'react';
import { hasAnyRole, resolveCurrentRole, ROLE_GOVERNANCE_MARKER } from '../../lib/roleAccess';

export default function RoleGuard({
  allowed = ['owner', 'admin'],
  userRole,
  title = 'Acesso restrito',
  description = 'Esta área exige perfil administrativo. Continue com uma conta owner ou admin.',
  children,
}) {
  const currentRole = resolveCurrentRole(userRole);
  const granted = hasAnyRole(currentRole, allowed);

  if (granted) return children;

  return (
    <div className="aa-access-denied" data-marker={ROLE_GOVERNANCE_MARKER}>
      <div className="aa-access-denied__eyebrow">Permissão insuficiente</div>
      <h2 className="aa-access-denied__title">{title}</h2>
      <p className="aa-access-denied__description">{description}</p>

      <div className="aa-access-denied__meta">
        <span className="aa-access-denied__pill">Papel atual: {currentRole}</span>
        <span className="aa-access-denied__pill">Permitidos: {allowed.join(', ')}</span>
      </div>
    </div>
  );
}
