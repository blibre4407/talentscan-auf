import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const AUF_HUBS = [
  'Rabat (Morocco)', 'Paris (France)', 'Dakar (Senegal)', 
  'Montreal (Canada)', 'Brussels (Belgium)', 'London (UK)', 
  'Johannesburg (South Africa)'
];

const ProfileView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/cv/${id}`);
        setProfile(response.data);
        setEditForm(response.data);
      } catch (err) {
        setError("Failed to load profile data. It may not exist.");
      }
    };
    fetchProfile();
  }, [id]);

  const handleDownload = () => {
    window.open(`http://localhost:8000/cv/${id}/download`, '_blank');
  };

  const handleUpdate = async () => {
    try {
      await axios.put(`http://localhost:8000/cv/${id}/update`, {
        hub: editForm.hub,
        full_name: editForm.full_name,
        phone_number: editForm.phone || "",
        email: editForm.email || "",
        skills: editForm.skills || "",
        experience: editForm.experience || "",
        education: editForm.education || ""
      });
      setProfile({ 
        ...editForm, 
        content: `Name: ${editForm.full_name}\nHub: ${editForm.hub}\nSkills: ${editForm.skills}\nExperience: ${editForm.experience}\nEducation: ${editForm.education}` 
      });
      setIsEditing(false);
    } catch (err) {
      alert("Failed to update profile. Please try again.");
    }
  };

  if (error) return <div className="text-red-500 p-8 text-center font-medium">{error}</div>;
  if (!profile) return <div className="p-8 text-center text-slate-500">Loading Profile...</div>;

  // Helper to split a skills string into individual array chips safely
  const renderSkillChips = (skillsString) => {
    if (!skillsString) return <span className="text-slate-400 text-sm">No skills listed</span>;
    return skillsString.split(',').map((skill, index) => {
      const trimmed = skill.trim();
      if (!trimmed) return null;
      return (
        <span 
          key={index} 
          className="inline-block bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded border border-slate-200"
        >
          {trimmed}
        </span>
      );
    });
  };

  return (
    <div className="max-w-6xl mx-auto bg-slate-50 p-6 rounded-2xl min-h-screen">
      
      {/* Top Controller Header */}
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center font-medium bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back
        </button>
        <div className="flex space-x-2">
          {profile.is_manual && !isEditing && (
            <button 
              onClick={() => setIsEditing(true)} 
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium shadow-sm transition-colors"
            >
              Edit Profile
            </button>
          )}
          <button 
            onClick={handleDownload} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
            Download Original CV
          </button>
        </div>
      </div>

      {isEditing ? (
        /* Edit Mode Window */
        <div className="bg-white p-8 rounded-xl border border-slate-200 space-y-4 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Modify Profile Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" 
                         value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} />
              </div>
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hub Location</label>
                  <select className="w-full border border-slate-300 p-2 rounded-lg bg-white focus:ring-blue-500 outline-none" 
                          value={editForm.hub} onChange={e => setEditForm({...editForm, hub: e.target.value})}>
                    {AUF_HUBS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
              </div>
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" 
                         value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
              </div>
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" 
                         value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              </div>
          </div>
          <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Skills (Separate with commas)</label>
              <textarea className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" 
                        rows="2" value={editForm.skills} onChange={e => setEditForm({...editForm, skills: e.target.value})} />
          </div>
          <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Experience Block</label>
              <textarea className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" 
                        rows="4" value={editForm.experience} onChange={e => setEditForm({...editForm, experience: e.target.value})} />
          </div>
          <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Education Background</label>
              <textarea className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" 
                        rows="3" value={editForm.education} onChange={e => setEditForm({...editForm, education: e.target.value})} />
          </div>
          <div className="pt-2 flex items-center">
              <button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-colors">
                Save Changes
              </button>
              <button onClick={() => setIsEditing(false)} className="ml-4 text-slate-500 hover:text-slate-700 font-medium">
                Cancel
              </button>
          </div>
        </div>
      ) : (
        /* The requested Polished Layout Structure */
        <div className="space-y-6">
          
          {/* Main Title Badge Banner */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                {profile.is_manual ? profile.full_name : profile.filename}
              </h1>
              <p className="text-sm text-slate-500 mt-1">Institutional Talent Database Resource Profile</p>
            </div>
            <div className="flex space-x-2">
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider">
                {profile.hub}
              </span>
              {profile.is_manual && (
                <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-1 rounded-md">
                  Internal Entry
                </span>
              )}
            </div>
          </div>

          {/* Core Info Metadata Grid Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Email Interface</span>
              <span className="text-slate-700 font-medium text-sm break-all">{profile.email || 'No registry file available'}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Telecom Link</span>
              <span className="text-slate-700 font-medium text-sm">{profile.phone || 'No registry file available'}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Assigned Base Hub</span>
              <span className="text-slate-700 font-medium text-sm">{profile.hub}</span>
            </div>
          </div>

          {/* Conditional Complex Row Grid Block */}
          {(profile.skills || profile.experience || profile.education) ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Left Column Section: Capabilities (Skills) Card */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
                    Capabilities Inventory
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Identified matching vector parameters</p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {renderSkillChips(profile.skills)}
                </div>
              </div>

              {/* Right Column Section: Structured History Text Blocks (Takes 2 Columns) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Experience Content Segment */}
                {profile.experience && (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 mb-4">
                      Professional Operations Summary
                    </h3>
                    <div className="pl-4 border-l-2 border-blue-500/30 ml-1 py-1 text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                      {profile.experience}
                    </div>
                  </div>
                )}

                {/* Education Content Segment */}
                {profile.education && (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 mb-4">
                      Academic & Degrees Foundation
                    </h3>
                    <div className="pl-4 border-l-2 border-blue-500/30 ml-1 py-1 text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                      {profile.education}
                    </div>
                  </div>
                )}
                
              </div>
            </div>
          ) : (
            /* Backup Layout Module for Generic Raw PDF Extractions */
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 mb-4">
                Extracted Document Core Text
              </h3>
              <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 text-slate-600 whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[500px] overflow-y-auto">
                {profile.content}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default ProfileView;