import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { API_BASE_URL } from '../utils/api';
import Notification from './Notification';

const AUF_HUBS = [
  'Rabat (Morocco)', 'Paris (France)', 'Dakar (Senegal)',
  'Montreal (Canada)', 'Brussels (Belgium)', 'London (UK)',
  'Johannesburg (South Africa)',
];

const REVIEW_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'review_later', label: 'Review Later' },
  { value: 'rejected', label: 'Rejected' },
];

const ProfileView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [reviewState, setReviewState] = useState({ profile_status: 'new', recruiter_notes: '' });
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/cv/${id}`);
        if (!mounted) return;
        setProfile(response.data);
        setEditForm(response.data);
        setReviewState({
          profile_status: response.data.profile_status || 'new',
          recruiter_notes: response.data.recruiter_notes || '',
        });
      } catch (error) {
        if (mounted) {
          setNotification({
            type: 'error',
            title: 'Unable to load profile',
            message: error.response?.data?.detail || 'This profile could not be found.',
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleDownload = () => {
    window.open(`${API_BASE_URL}/cv/${id}/download`, '_blank');
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/cv/${id}/update`, {
        hub: editForm.hub,
        full_name: editForm.full_name,
        phone_number: editForm.phone || '',
        email: editForm.email || '',
        skills: editForm.skills || '',
        experience: editForm.experience || '',
        education: editForm.education || '',
        parser_source: editForm.parser_source || 'manual',
        parser_confidence: editForm.parser_confidence || 100,
        parser_missing_sections: editForm.parser_missing_sections || [],
        profile_status: reviewState.profile_status,
        recruiter_notes: reviewState.recruiter_notes,
      });
      const nextProfile = {
        ...editForm,
        profile_status: reviewState.profile_status,
        recruiter_notes: reviewState.recruiter_notes,
        content: `Name: ${editForm.full_name}\nHub: ${editForm.hub}\nSkills: ${editForm.skills}\nExperience: ${editForm.experience}\nEducation: ${editForm.education}`,
      };
      setProfile(nextProfile);
      setEditForm(nextProfile);
      setIsEditing(false);
      setNotification({
        type: 'success',
        title: 'Profile updated',
        message: 'The manual profile was updated and the semantic index was rebuilt to keep search results consistent.',
      });
    } catch (error) {
      setNotification({
        type: 'error',
        title: 'Update failed',
        message: error.response?.data?.detail || 'Please try again.',
      });
    }
  };

  const handleReviewSave = async () => {
    try {
      await api.put(`/cv/${id}/review`, reviewState);
      setProfile((current) => ({ ...current, ...reviewState }));
      setNotification({
        type: 'success',
        title: 'Review saved',
        message: 'Recruiter status and notes were updated successfully.',
      });
    } catch (error) {
      setNotification({
        type: 'error',
        title: 'Review update failed',
        message: error.response?.data?.detail || 'Please try again.',
      });
    }
  };

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

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Profile...</div>;
  if (!profile) return <div className="p-8 text-center text-slate-500">Profile unavailable.</div>;

  return (
    <div className="max-w-6xl mx-auto bg-slate-50 p-6 rounded-2xl min-h-screen">
      {notification && (
        <div className="mb-6">
          <Notification {...notification} onClose={() => setNotification(null)} />
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center font-medium bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
        <div className="flex space-x-2">
          {profile.is_manual && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium shadow-sm transition-colors"
            >
              Edit Manual Profile
            </button>
          )}
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download CV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            {profile.full_name || profile.filename}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Institutional Talent Database Resource Profile</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider">
              {profile.hub}
            </span>
            <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-1 rounded-md">
              Parser: {profile.parser_source || 'manual'}
            </span>
            <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-1 rounded-md">
              Confidence: {profile.parser_confidence || 0}%
            </span>
          </div>
          {profile.parser_missing_sections?.length > 0 && (
            <p className="text-sm text-amber-700 mt-4">
              Missing sections flagged during parsing: {profile.parser_missing_sections.join(', ')}
            </p>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 mb-4">
            Recruiter Review
          </h3>
          <label className="block text-sm font-medium text-slate-700 mb-1">Candidate Status</label>
          <select
            value={reviewState.profile_status}
            onChange={(e) => setReviewState((current) => ({ ...current, profile_status: e.target.value }))}
            className="w-full border border-slate-300 p-2 rounded-lg bg-white focus:ring-blue-500 outline-none mb-4"
          >
            {REVIEW_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <label className="block text-sm font-medium text-slate-700 mb-1">Recruiter Notes</label>
          <textarea
            rows="6"
            value={reviewState.recruiter_notes}
            onChange={(e) => setReviewState((current) => ({ ...current, recruiter_notes: e.target.value }))}
            className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none"
            placeholder="Add context for the next reviewer or for the defense demo..."
          />
          <button onClick={handleReviewSave} className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Save Recruiter Review
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 space-y-4 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Modify Profile Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" value={editForm.full_name || ''} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hub Location</label>
              <select className="w-full border border-slate-300 p-2 rounded-lg bg-white focus:ring-blue-500 outline-none" value={editForm.hub || ''} onChange={(e) => setEditForm({ ...editForm, hub: e.target.value })}>
                {AUF_HUBS.map((hub) => <option key={hub} value={hub}>{hub}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Skills (Separate with commas)</label>
            <textarea className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" rows="2" value={editForm.skills || ''} onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Experience Block</label>
            <textarea className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" rows="4" value={editForm.experience || ''} onChange={(e) => setEditForm({ ...editForm, experience: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Education Background</label>
            <textarea className="w-full border border-slate-300 p-2 rounded-lg focus:ring-blue-500 outline-none" rows="3" value={editForm.education || ''} onChange={(e) => setEditForm({ ...editForm, education: e.target.value })} />
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Email</span>
              <span className="text-slate-700 font-medium text-sm break-all">{profile.email || 'No email available'}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Phone</span>
              <span className="text-slate-700 font-medium text-sm">{profile.phone || 'No phone available'}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Current Status</span>
              <span className="text-slate-700 font-medium text-sm">{profile.profile_status || 'new'}</span>
            </div>
          </div>

          {(profile.skills || profile.experience || profile.education) ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
                    Capabilities Inventory
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Structured recruiter-validated expertise</p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {renderSkillChips(profile.skills)}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
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
