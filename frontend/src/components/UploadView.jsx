import React, { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import { extractDataFromPDF } from '../utils/pdfParser';
import Notification from './Notification';

const AUF_HUBS = [
  'Rabat (Morocco)', 'Paris (France)', 'Dakar (Senegal)',
  'Montreal (Canada)', 'Brussels (Belgium)', 'London (UK)',
  'Johannesburg (South Africa)',
];

const emptyForm = {
  full_name: '',
  phone_number: '',
  email: '',
  skills: '',
  experience: '',
  education: '',
};

const emptyParserMeta = {
  parser_source: 'manual',
  parser_confidence: 100,
  parser_missing_sections: [],
};

const UploadView = () => {
  const [inputMode, setInputMode] = useState('pdf');
  const [selectedHub, setSelectedHub] = useState(AUF_HUBS[0]);
  const [originalFile, setOriginalFile] = useState(null);
  const [manualForm, setManualForm] = useState(emptyForm);
  const [parserMeta, setParserMeta] = useState(emptyParserMeta);
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [notification, setNotification] = useState(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState([]);

  const missingFieldWarnings = useMemo(() => {
    const warnings = [];
    if (!manualForm.full_name.trim()) warnings.push('Full name is missing.');
    if (!manualForm.skills.trim()) warnings.push('Skills are still empty.');
    if (!manualForm.experience.trim()) warnings.push('Experience is still empty.');
    return warnings;
  }, [manualForm]);

  const updateField = (field, value) => {
    setManualForm((current) => ({ ...current, [field]: value }));
  };

  const fallbackParseWithBackend = async (file, originalError) => {
    const fallbackFormData = new FormData();
    fallbackFormData.append('file', file);
    const response = await api.post('/parse-pdf', fallbackFormData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    setManualForm((current) => ({
      ...current,
      full_name: response.data.full_name || current.full_name,
      phone_number: response.data.phone_number || current.phone_number,
      email: response.data.email || current.email,
      skills: response.data.skills || current.skills,
      experience: response.data.experience || current.experience,
      education: response.data.education || current.education,
    }));
    setParserMeta({
      parser_source: response.data.parser_source,
      parser_confidence: response.data.parser_confidence,
      parser_missing_sections: response.data.parser_missing_sections || [],
    });
    setNotification({
      type: 'warning',
      title: 'Fallback parser used',
      message: `Local PDF parsing failed, so the backend extracted the CV using a safer fallback. Original parser error: ${originalError.message}`,
    });
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles?.length) return;

    const file = acceptedFiles[0];
    setOriginalFile(file);
    setStatus('processing');
    setNotification(null);
    setDuplicateCandidates([]);

    try {
      const parsedData = await extractDataFromPDF(file);
      setManualForm((current) => ({ ...current, ...parsedData }));
      setParserMeta({
        parser_source: parsedData.parser_source,
        parser_confidence: parsedData.parser_confidence,
        parser_missing_sections: parsedData.parser_missing_sections || [],
      });
      setInputMode('review');
    } catch (error) {
      try {
        await fallbackParseWithBackend(file, error);
        setInputMode('review');
      } catch (fallbackError) {
        setNotification({
          type: 'error',
          title: 'Parsing failed',
          message: `Neither the local parser nor the backend fallback could extract the CV automatically. You can still review and enter the data manually. Details: ${fallbackError.response?.data?.detail || fallbackError.message}`,
        });
        setParserMeta({
          parser_source: 'manual-review-required',
          parser_confidence: 0,
          parser_missing_sections: ['skills', 'experience', 'education'],
        });
        setInputMode('review');
      }
    } finally {
      setStatus('idle');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const handleUploadSmart = async () => {
    if (!manualForm.full_name.trim()) {
      setNotification({
        type: 'error',
        title: 'Full name required',
        message: 'Please confirm the candidate name before saving the profile.',
      });
      return;
    }

    setStatus('saving');
    setNotification(null);

    try {
      let response;

      if (originalFile) {
        const formData = new FormData();
        formData.append('file', originalFile);
        formData.append('hub', selectedHub);
        formData.append('full_name', manualForm.full_name);
        formData.append('email', manualForm.email);
        formData.append('phone_number', manualForm.phone_number);
        formData.append('skills', manualForm.skills);
        formData.append('experience', manualForm.experience);
        formData.append('education', manualForm.education);
        formData.append('parser_source', parserMeta.parser_source);
        formData.append('parser_confidence', String(parserMeta.parser_confidence));
        formData.append('parser_missing_sections', parserMeta.parser_missing_sections.join(','));

        response = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        response = await api.post('/upload-manual', {
          ...manualForm,
          hub: selectedHub,
          ...parserMeta,
        });
      }

      setResult(response.data);
      setDuplicateCandidates(response.data.duplicates || []);
      setStatus('success');
      setNotification({
        type: 'success',
        title: 'Profile saved',
        message: 'The candidate profile was indexed successfully and is now available for semantic search.',
      });
    } catch (error) {
      setStatus('error');
      setNotification({
        type: 'error',
        title: 'Indexing failed',
        message: error.response?.data?.detail || 'An error occurred while saving the candidate profile.',
      });
    }
  };

  const resetUpload = () => {
    setInputMode('pdf');
    setOriginalFile(null);
    setManualForm(emptyForm);
    setParserMeta(emptyParserMeta);
    setStatus('idle');
    setResult(null);
    setNotification(null);
    setDuplicateCandidates([]);
  };

  return (
    <div className="max-w-4xl mx-auto mt-6 bg-slate-50 p-6 rounded-2xl min-h-screen">
      <div className="mb-8 flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Smart Candidate Ingestion</h2>
          <p className="text-slate-500 mt-1 text-sm">Upload a CV, validate the extracted sections, then save a trustworthy recruiter-ready profile.</p>
        </div>
      </div>

      {notification && (
        <div className="mb-6">
          <Notification {...notification} onClose={() => setNotification(null)} />
        </div>
      )}

      <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Target Regional Hub</label>
        <select
          value={selectedHub}
          onChange={(e) => setSelectedHub(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 outline-none"
        >
          {AUF_HUBS.map((hub) => <option key={hub} value={hub}>{hub}</option>)}
        </select>
      </div>

      {inputMode === 'pdf' && status !== 'saving' && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-16 flex flex-col items-center justify-center text-center cursor-pointer bg-white transition-all ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}`}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 mb-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          </div>
          <p className="text-lg font-medium text-slate-700">Drag and drop a CV to start the AI-assisted review flow</p>
          <p className="text-sm text-slate-400 mt-2">The system first tries the smart browser parser, then falls back to backend extraction if needed.</p>

          <button onClick={(e) => { e.stopPropagation(); setInputMode('review'); }} className="mt-6 text-sm text-blue-600 hover:underline">
            Skip upload and enter data manually
          </button>
        </div>
      )}

      {status === 'processing' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          <p className="text-slate-800 font-semibold">Parsing CV...</p>
          <p className="text-sm text-slate-500 mt-2">We are extracting candidate sections and preparing the recruiter review form.</p>
        </div>
      )}

      {inputMode === 'review' && status !== 'success' && status !== 'processing' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800">Verify Parsed Data</h3>
              <p className="text-sm text-slate-500 mt-1">Human validation stays in the loop before indexing.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {originalFile && <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">Source: {originalFile.name}</span>}
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">Parser: {parserMeta.parser_source}</span>
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded">Confidence: {parserMeta.parser_confidence}%</span>
            </div>
          </div>

          {parserMeta.parser_missing_sections.length > 0 && (
            <div className="mb-4">
              <Notification
                type="warning"
                title="Review recommended"
                message={`The parser could not confidently detect: ${parserMeta.parser_missing_sections.join(', ')}.`}
              />
            </div>
          )}

          {missingFieldWarnings.length > 0 && (
            <div className="mb-4">
              <Notification
                type="info"
                title="Before saving"
                message={missingFieldWarnings.join(' ')}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input type="text" value={manualForm.full_name} onChange={(e) => updateField('full_name', e.target.value)} className="w-full border p-2 rounded focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input type="email" value={manualForm.email} onChange={(e) => updateField('email', e.target.value)} className="w-full border p-2 rounded focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input type="tel" value={manualForm.phone_number} onChange={(e) => updateField('phone_number', e.target.value)} className="w-full border p-2 rounded focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Key Skills & Competencies</label>
              <textarea value={manualForm.skills} onChange={(e) => updateField('skills', e.target.value)} rows="3" className="w-full border p-2 rounded focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Professional Experience</label>
              <textarea value={manualForm.experience} onChange={(e) => updateField('experience', e.target.value)} rows="5" className="w-full border p-2 rounded focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Education Background</label>
              <textarea value={manualForm.education} onChange={(e) => updateField('education', e.target.value)} rows="3" className="w-full border p-2 rounded focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button onClick={resetUpload} className="px-5 py-2 rounded-md font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
            <button onClick={handleUploadSmart} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md font-medium shadow-sm flex items-center">
              {status === 'saving' ? 'Saving...' : 'Save to Database'}
            </button>
          </div>
        </div>
      )}

      {status === 'success' && result && (
        <div className="space-y-6 mt-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-bold text-green-800 mb-2">Profile Ingested Successfully</h3>
            <p className="text-green-700 mb-6">Database Vector ID: {result.vector_id}</p>
            <button onClick={resetUpload} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm">
              Ingest Another Candidate
            </button>
          </div>

          {duplicateCandidates.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h4 className="font-semibold text-amber-900 mb-3">Possible duplicates detected</h4>
              <div className="space-y-2">
                {duplicateCandidates.map((candidate) => (
                  <div key={candidate.id} className="bg-white border border-amber-100 rounded-lg px-3 py-2 text-sm text-slate-700">
                    {candidate.full_name || 'Unnamed Profile'} • {candidate.email || 'No email'} • {candidate.hub}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadView;
