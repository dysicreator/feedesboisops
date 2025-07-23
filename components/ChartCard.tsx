import React from 'react';

interface ChartCardProps {
  title: string;
  chartId: string;
  note?: string;
  className?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, chartId, note, className = '' }) => (
  <div className={`bg-white p-4 rounded-lg shadow-md h-full ${className}`}>
    <h4 className="text-md font-semibold text-brand-dark mb-2">{title}</h4>
    <div className="relative h-64 md:h-72">
      <canvas id={chartId}></canvas>
    </div>
    {note && <p className="text-xs text-gray-400 mt-2 text-center">{note}</p>}
  </div>
);

export default ChartCard;
