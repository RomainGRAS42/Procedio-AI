import React from 'react';
import { Radar, RadarChart as RechartsRadar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface RadarChartData {
  subject: string;
  value: number;
  fullMark?: number;
}

interface RadarChartProps {
  data: RadarChartData[];
  dataKey?: string;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  height?: number;
  showTooltip?: boolean;
}

const RadarChart: React.FC<RadarChartProps> = ({
  data,
  dataKey = 'value',
  color = '#f59e0b',
  fillOpacity = 0.2,
  strokeWidth = 3,
  height = 250,
  showTooltip = true
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200" style={{ height }}>
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
          <i className="fa-solid fa-chart-radar text-xl"></i>
        </div>
        <p className="text-slate-500 font-bold text-sm">Aucune donnée disponible</p>
        <p className="text-slate-400 text-[10px] mt-1">Les compétences apparaîtront ici.</p>
      </div>
    );
  }

  const chartData = data.map(item => ({
    subject: item.subject,
    [dataKey]: item.value,
    fullMark: item.fullMark || 100
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} 
          />
          <Radar 
            name="Compétences" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={strokeWidth} 
            fill={color} 
            fillOpacity={fillOpacity} 
          />
          {showTooltip && <Tooltip />}
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
};

export default RadarChart;
