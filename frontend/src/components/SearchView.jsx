import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import api from '../utils/api';
import Notification from './Notification';
import AnalyticsOverview from './AnalyticsOverview';

ChartJS.register(ArcElement, Tooltip, Legend);

const AUF_HUBS = [
  'All Hubs',
  'Rabat (Morocco)', 'Paris (France)', 'Dakar (Senegal)',
  'Montreal (Canada)', 'Brussels (Belgium)', 'London (UK)',
  'Johannesburg (South Africa)',
];

const statusClasses = {
  new: 'bg-slate-100 text-slate-700 border-slate-200',
  shortlisted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  review_later: 'bg-amber-100 text-amber-900 border-amber-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
};

const SearchView = () => {
  const navigate = useNavigate();
  const [jobDescription, setJobDescription] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [hubFilter, setHubFilter] = useState('All Hubs');
  const [results, setResults] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadAnalytics = async () => {
      try {
        const response = await api.get('/analytics/overview');
        if (mounted) setAnalytics(response.data);
      } catch (loadError) {
        if (mounted) {
          setNotice({
            type: 'warning',
            title: 'Analytics unavailable',
            message: loadError.response?.data?.detail || 'The dashboard metrics could not be loaded right now.',
          });
        }
      } finally {
        if (mounted) setAnalyticsLoading(false);
      }
    };

    loadAnalytics();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!jobDescription.trim() && !nameSearch.trim()) return;

    setIsSearching(true);
    setError('');
    setNotice(null);
    setResults([]);

    try {
      const response = await api.post('/search', {
        job_description: jobDescription,
        name_search: nameSearch,
        hub_filter: hubFilter,
        top_k: 10,
      });

      setResults(response.data.top_matches || []);
      if (response.data.notice) {
        setNotice({
          type: 'info',
          title: 'Search guidance',
          message: response.data.notice,
        });
      }
      if ((response.data.top_matches || []).length === 0) {
        setError('No matching candidates were found for this search. Try a broader job description or remove a filter.');
      }
    } catch (searchError) {
      setError(searchError.response?.data?.detail || 'An error occurred while searching the database.');
    } finally {
      setIsSearching(false);
    }
  };

  const getChartData = (score) => {
    const numScore = score === 'Direct Match' ? 100 : score;
    return {
      labels: ['Match', 'Gap'],
      datasets: [{
        data: [numScore, 100 - numScore],
        backgroundColor: [
          numScore >= 80 ? 'rgba(34, 197, 94, 0.85)' : numScore >= 60 ? 'rgba(245, 158, 11, 0.85)' : 'rgba(244, 63, 94, 0.85)',
          'rgba(229, 231, 235, 1)',
        ],
        borderWidth: 0,
      }],
    };
  };

  return (
    <div className="max-w-6xl mx-auto mt-6">
      <AnalyticsOverview analytics={analytics} loading={analyticsLoading} />

      {notice && (
        <div className="mb-6">
          <Notification {...notice} onClose={() => setNotice(null)} />
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Talent Search</h2>

        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search by Name</label>
              <input
                type="text"
                placeholder="e.g., John Doe"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Hub</label>
              <select
                value={hubFilter}
                onChange={(e) => setHubFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                {AUF_HUBS.map((hub) => <option key={hub} value={hub}>{hub}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semantic Job Description</label>
            <textarea
              className="w-full p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              rows="5"
              placeholder="e.g., Nous recherchons un développeur avec de l'expérience en React, Python et coordination produit..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSearching || (!jobDescription.trim() && !nameSearch.trim())}
              className={`px-6 py-2 rounded-md text-white font-medium transition duration-200 ${isSearching || (!jobDescription.trim() && !nameSearch.trim()) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isSearching ? 'Analyzing...' : 'Search Engine'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="mb-6">
          <Notification type="error" title="Search status" message={error} />
        </div>
      )}

      {!isSearching && results.length === 0 && !error && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 shadow-sm">
          Enter a candidate name or a job description to start the matching workflow.
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Search Results</h3>
          {results.map((cv, index) => (
            <div key={cv.cv_id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col gap-4 md:flex-row md:items-center hover:shadow-md transition-shadow">
              <div className="flex items-center w-full md:w-auto">
                <div className="text-gray-400 font-bold text-2xl w-12 text-center">#{index + 1}</div>
                <div className="w-16 h-16 md:w-20 md:h-20 relative mr-6 flex-shrink-0">
                  <Doughnut data={getChartData(cv.similarity_score)} options={{ cutout: '75%', plugins: { tooltip: { enabled: false }, legend: { display: false } } }} />
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-xs md:text-sm font-bold text-gray-700">
                      {cv.similarity_score === 'Direct Match' ? '100%' : `${Math.round(cv.similarity_score)}%`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-grow">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-lg font-semibold text-blue-700 truncate">{cv.full_name || cv.filename}</h4>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded border border-blue-200">
                    {cv.hub}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${statusClasses[cv.profile_status] || statusClasses.new}`}>
                    {cv.profile_status || 'new'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{cv.preview}</p>
                <p className="text-sm text-slate-700 mt-3">{cv.match_reason}</p>
                {cv.matched_keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {cv.matched_keywords.map((keyword) => (
                      <span key={`${cv.cv_id}-${keyword}`} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full border border-slate-200">
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-2 md:mt-0 md:ml-4 flex-shrink-0 flex justify-end">
                <button
                  onClick={() => navigate(`/profile/${cv.cv_id}`)}
                  className="text-white text-sm font-medium rounded px-4 py-2 bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  View Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchView;
