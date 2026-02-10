import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, MessageCircle, DollarSign, Activity } from 'lucide-react';

const Card = ({ title, value, subtext, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-800 mt-2">{value}</h3>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-full ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const { session } = useAuth();
  const [overview, setOverview] = useState(null);
  const [temporal, setTemporal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard data
    const fetchData = async () => {
      if (!session) return;
      
      try {
        const headers = {
          'Authorization': `Bearer ${session.access_token}`
        };

        // Fetch Overview
        const resOverview = await fetch(`/api/metrics/overview`, { headers });
        let dataOverview = {};
        if (resOverview.ok) {
          try {
            dataOverview = await resOverview.json();
          } catch (e) {
            console.warn('Invalid JSON from overview endpoint', e);
          }
        }
        
        // Fetch Temporal
        const resTemporal = await fetch(`/api/metrics/temporal?days=30`, { headers });
        let dataTemporal = {};
        if (resTemporal.ok) {
           try {
             dataTemporal = await resTemporal.json();
           } catch (e) {
             console.warn('Invalid JSON from temporal endpoint', e);
           }
        }

        if (dataOverview.success) setOverview(dataOverview.data);
        if (dataTemporal.success) setTemporal(dataTemporal.data);
      } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  if (loading) return <div className="text-center p-10">Carregando dashboard...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Visão Geral</h2>
        <p className="text-gray-500">Métricas operacionais em tempo real</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          title="Conversas (Ciclo)" 
          value={`${overview?.usage?.conversations?.used || 0} / ${overview?.usage?.conversations?.total || 0}`}
          subtext={`Restantes: ${overview?.usage?.conversations?.remaining || 0}`}
          icon={MessageCircle}
          color="bg-blue-500"
        />
        <Card 
          title="Templates (Ciclo)" 
          value={`${overview?.usage?.templates?.used || 0} / ${overview?.usage?.templates?.total || 0}`}
          subtext={`Restantes: ${overview?.usage?.templates?.remaining || 0}`}
          icon={TrendingUp}
          color="bg-green-500"
        />
        <Card 
          title="Atendimentos Hoje" 
          value={overview?.attendance?.total_tracked || 0}
          subtext={`Bot: ${overview?.attendance?.bot || 0} | Humano: ${overview?.attendance?.human || 0}`}
          icon={Users}
          color="bg-purple-500"
        />
        <Card 
          title="Status Financeiro" 
          value={overview?.financial?.status?.toUpperCase() || 'N/A'}
          subtext={`Plano: ${overview?.financial?.plan || 'Nenhum'}`}
          icon={DollarSign}
          color={overview?.financial?.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}
        />
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-blue-600" />
          Volume de Mensagens (30 Dias)
        </h3>
        <div className="h-80 w-full">
          {temporal?.history?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={temporal.history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(str) => {
                    const d = new Date(str);
                    return `${d.getDate()}/${d.getMonth()+1}`;
                  }}
                  tick={{fontSize: 12}}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              Sem dados históricos suficientes
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
