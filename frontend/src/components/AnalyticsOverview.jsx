import React from 'react';

const AnalyticsOverview = ({ analytics, loading }) => {
  const cards = [
    { label: 'Profiles', value: analytics?.total_profiles ?? '--' },
    { label: 'Manual Entries', value: analytics?.manual_profiles ?? '--' },
    { label: 'Avg Parser Confidence', value: analytics ? `${analytics.average_parser_confidence}%` : '--' },
    { label: 'FAISS Index Size', value: analytics?.faiss_index_size ?? '--' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-slate-500">{card.label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {loading ? '...' : card.value}
          </p>
        </div>
      ))}
    </div>
  );
};

export default AnalyticsOverview;
