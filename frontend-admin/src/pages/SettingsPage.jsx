import React from 'react';
import { useAuth } from '../context/AuthContext';
import WhatsAppConnect from '../components/WhatsAppConnect';

const SettingsPage = () => {
  const { user } = useAuth();
  
  // Mock settings data since we don't have a full settings API yet
  // We can fetch company info though
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Configurações</h2>
        <p className="text-gray-500">Gerencie agentes e preferências</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Informações da Empresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
             <label className="block text-sm font-medium text-gray-700">Email Admin</label>
             <div className="mt-1 p-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-600 font-mono">
               {user?.email}
             </div>
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700">User ID</label>
             <div className="mt-1 p-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-600 font-mono">
               {user?.id}
             </div>
           </div>
        </div>
      </div>

      <WhatsAppConnect />

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Agentes de Atendimento</h3>
          <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
            Adicionar Agente
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Mock Agents */}
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Agente Padrão</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">agente@empresa.com</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Ativo
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a href="#" className="text-blue-600 hover:text-blue-900">Editar</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
