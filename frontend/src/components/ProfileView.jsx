import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ProfileView = ({ cvId, onBack }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/cv/${cvId}`);
        setProfile(response.data);
      } catch (err) {
        setError('Failed to load profile data.');
      } finally {
        setLoading(false);
      }
    };

    if (cvId) {
      fetchProfile();
    }
  }, [cvId]);

  if (loading) return <div className="text-center mt-10">Loading profile...</div>;
  if (error) return <div className="text-center mt-10 text-red-600">{error}</div>;
  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto mt-6 bg-white p-8 rounded-lg shadow-md border border-gray-200">
      <button 
        onClick={onBack}
        className="mb-6 flex items-center text-blue-600 hover:text-blue-800 transition-colors font-medium text-sm"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
        </svg>
        Back to Search Results
      </button>

      <div className="border-b border-gray-200 pb-5 mb-6">
        <h2 className="text-3xl font-bold text-gray-900">{profile.filename}</h2>
        <p className="text-sm text-gray-500 mt-2">Database ID: #{profile.id}</p>
      </div>

      <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
        {/* We use whitespace-pre-wrap to respect the line breaks from the parsed PDF */}
        {profile.content}
      </div>
    </div>
  );
};

export default ProfileView;