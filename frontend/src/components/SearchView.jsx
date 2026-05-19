import React, { useState } from 'react';
import axios from 'axios';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';

// Register ChartJS elements
ChartJS.register(ArcElement, Tooltip, Legend);

const AUF_HUBS = [
  'All Hubs',
  'Rabat (Morocco)', 'Paris (France)', 'Dakar (Senegal)', 
  'Montreal (Canada)', 'Brussels (Belgium)', 'London (UK)', 
  'Johannesburg (South Africa)'
];

const SearchView = () => {
  const navigate = useNavigate(); // <-- Remplacement de onViewProfile
  
  const [jobDescription, setJobDescription] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [hubFilter, setHubFilter] = useState('All Hubs');
  
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!jobDescription.trim() && !nameSearch.trim()) return;

    setIsSearching(true);
    setError('');
    setResults([]);

    try {
      const response = await axios.post('http://localhost:8000/search', {
        job_description: jobDescription,
        name_search: nameSearch,
        hub_filter: hubFilter,
        top_k: 10
      });
      
      setResults(response.data.top_matches || []);
      if (response.data.top_matches.length === 0) {
        setError('No matching candidates found for this search.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('An error occurred while searching the database.');
    } finally {
      setIsSearching(false);
    }
  };

  // Helper function to generate the chart data for a specific score
  const getChartData = (score) => {
    // Si c'est une recherche directe par nom, on met 100%
    const numScore = score === "Direct Match" ? 100 : score;
    return {
      labels: ['Match', 'Gap'],
      datasets: [{
        data: [numScore, 100 - numScore],
        backgroundColor: [
          numScore >= 80 ? 'rgba(34, 197, 94, 0.8)' : numScore >= 60 ? 'rgba(234, 179, 8, 0.8)' : 'rgba(239, 68, 68, 0.8)',
          'rgba(229, 231, 235, 1)' 
        ],
        borderWidth: 0,
      }],
    };
  };

  return (
    <div className="max-w-4xl mx-auto mt-6">
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Talent Search</h2>
        
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Direct Name Search */}
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
            {/* Hub Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Hub</label>
              <select 
                value={hubFilter}
                onChange={(e) => setHubFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                {AUF_HUBS.map(hub => <option key={hub} value={hub}>{hub}</option>)}
              </select>
            </div>
          </div>

          {/* Semantic Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semantic Job Description</label>
            <textarea
              className="w-full p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              rows="4"
              placeholder="e.g., Nous recherchons un développeur avec de l'expérience en React et Python..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            ></textarea>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button 
              type="submit" 
              disabled={isSearching || (!jobDescription.trim() && !nameSearch.trim())}
              className={`px-6 py-2 rounded-md text-white font-medium transition duration-200 ${
                isSearching || (!jobDescription.trim() && !nameSearch.trim()) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSearching ? 'Analyzing...' : 'Search Engine'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6 border border-red-200 text-center">
          {error}
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Search Results</h3>
          {results.map((cv, index) => (
            <div key={cv.cv_id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center hover:shadow-md transition-shadow">
              
              <div className="flex items-center mb-4 md:mb-0 w-full md:w-auto">
                {/* Rank Number */}
                <div className="text-gray-400 font-bold text-2xl w-12 text-center">
                  #{index + 1}
                </div>

                {/* Chart Visualization */}
                <div className="w-16 h-16 md:w-20 md:h-20 relative mr-6 flex-shrink-0">
                  <Doughnut 
                    data={getChartData(cv.similarity_score)} 
                    options={{ cutout: '75%', plugins: { tooltip: { enabled: false }, legend: { display: false } } }} 
                  />
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-xs md:text-sm font-bold text-gray-700">
                      {cv.similarity_score === "Direct Match" ? "100%" : `${Math.round(cv.similarity_score)}%`}
                    </span>
                  </div>
                </div>
              </div>

              {/* CV Metadata & Preview */}
              <div className="flex-grow">
                <div className="flex items-center space-x-2">
                  <h4 className="text-lg font-semibold text-blue-700 truncate">{cv.filename}</h4>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded border border-blue-200">
                    {cv.hub}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                  {cv.preview}
                </p>
              </div>
              
              {/* Action Button */}
              <div className="mt-4 md:mt-0 md:ml-4 flex-shrink-0 flex justify-end">
                <button 
                    onClick={() => navigate(`/profile/${cv.cv_id}`)} // <-- Correction ici
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