import React, { useState } from 'react';
import axios from 'axios';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Register ChartJS elements
ChartJS.register(ArcElement, Tooltip, Legend);

const SearchView = ({ onViewProfile }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!jobDescription.trim()) return;

    setIsSearching(true);
    setError('');
    setResults([]);

    try {
      const response = await axios.post('http://localhost:8000/search', {
        job_description: jobDescription,
        top_k: 5
      });
      
      setResults(response.data.top_matches || []);
      if (response.data.top_matches.length === 0) {
        setError('No matching candidates found in the database.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('An error occurred while searching the vector database.');
    } finally {
      setIsSearching(false);
    }
  };

  // Helper function to generate the chart data for a specific score
  const getChartData = (score) => ({
    labels: ['Match', 'Gap'],
    datasets: [
      {
        data: [score, 100 - score],
        backgroundColor: [
          score >= 80 ? 'rgba(34, 197, 94, 0.8)' : score >= 60 ? 'rgba(234, 179, 8, 0.8)' : 'rgba(239, 68, 68, 0.8)',
          'rgba(229, 231, 235, 1)' // Gray background for the remainder
        ],
        borderWidth: 0,
      },
    ],
  });

  return (
    <div className="max-w-4xl mx-auto mt-6">
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Semantic Candidate Search</h2>
        <p className="text-gray-600 mb-4 text-sm">
          Paste a job description below. The AI will convert it into a vector and find the closest mathematical matches among your ingested CVs.
        </p>
        
        <form onSubmit={handleSearch}>
          <textarea
            className="w-full p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            rows="5"
            placeholder="e.g., Nous recherchons un développeur Full-Stack avec de l'expérience en React, Python (FastAPI), et Docker..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          ></textarea>
          
          <div className="mt-4 flex justify-end">
            <button 
              type="submit" 
              disabled={isSearching || !jobDescription.trim()}
              className={`px-6 py-2 rounded-md text-white font-medium transition duration-200 ${
                isSearching || !jobDescription.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSearching ? 'Analyzing Vectors...' : 'Find Matches'}
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
          <h3 className="text-xl font-bold text-gray-800 mb-4">Top Candidates</h3>
          {results.map((cv, index) => (
            <div key={cv.cv_id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex items-center hover:shadow-md transition-shadow">
              
              {/* Rank Number */}
              <div className="text-gray-400 font-bold text-2xl w-12 text-center">
                #{index + 1}
              </div>

              {/* Chart Visualization */}
              <div className="w-20 h-20 relative mr-6 flex-shrink-0">
                <Doughnut 
                  data={getChartData(cv.similarity_score)} 
                  options={{ cutout: '75%', plugins: { tooltip: { enabled: false }, legend: { display: false } } }} 
                />
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-sm font-bold text-gray-700">{Math.round(cv.similarity_score)}%</span>
                </div>
              </div>

              {/* CV Metadata & Preview */}
              <div className="flex-grow">
                <h4 className="text-lg font-semibold text-blue-700">{cv.filename}</h4>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {cv.preview}
                </p>
              </div>
              
              {/* Action Button */}
              <div className="ml-4 flex-shrink-0">
                <button 
                    onClick={() => onViewProfile(cv.cv_id)} 
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium border border-blue-200 rounded px-3 py-1 bg-blue-50 hover:bg-blue-100 transition-colors"
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