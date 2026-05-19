import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { extractDataFromPDF } from '../utils/pdfParser'; // Import the new Smart Parser

const AUF_HUBS = [
  'Rabat (Morocco)', 'Paris (France)', 'Dakar (Senegal)', 
  'Montreal (Canada)', 'Brussels (Belgium)', 'London (UK)', 
  'Johannesburg (South Africa)'
];

const UploadView = () => {
  const [inputMode, setInputMode] = useState('pdf'); // 'pdf' or 'review'
  const [selectedHub, setSelectedHub] = useState(AUF_HUBS[0]);
  const [originalFile, setOriginalFile] = useState(null);
  
  const [manualForm, setManualForm] = useState({
    full_name: '', phone_number: '', email: '', skills: '', experience: '', education: ''
  });
  
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      const file = acceptedFiles[0];
      setOriginalFile(file);
      setStatus('processing');
      setErrorMsg('');

      try {
        // Run the Smart Client-Side Parser
        const parsedData = await extractDataFromPDF(file);
        
        // Auto-fill the form with the extracted data
        setManualForm(prev => ({ ...prev, ...parsedData }));
        
        // Switch user to the Review/Edit mode
        setInputMode('review');
        setStatus('idle');
      } catch (err) {
        console.error("PDF Parsing failed", err);
        setStatus('error');
        // Show the ACTUAL error message to figure out if Webpack is blocking the worker
        setErrorMsg(`Failed to parse the PDF locally. Error: ${err.message}`);
        setInputMode('review'); 
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, multiple: false,
  });

  const handleUploadSmart = async () => {
    if (!manualForm.full_name.trim()) {
        setStatus('error');
        setErrorMsg('Full Name is required.');
        return;
    }

    setStatus('processing');
    
    // We send BOTH the original PDF file AND the reviewed structured data
    const formData = new FormData();
    if (originalFile) formData.append('file', originalFile);
    formData.append('hub', selectedHub);
    formData.append('full_name', manualForm.full_name);
    formData.append('email', manualForm.email);
    formData.append('phone_number', manualForm.phone_number);
    formData.append('skills', manualForm.skills);
    formData.append('experience', manualForm.experience);
    formData.append('education', manualForm.education);

    try {
      const endpoint = originalFile ? 'http://localhost:8000/upload' : 'http://localhost:8000/upload-manual';
      const response = await axios.post(endpoint, originalFile ? formData : { ...manualForm, hub: selectedHub }, {
        headers: originalFile ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' }
      });
      
      setResult(response.data);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMsg('An error occurred during backend indexing.');
    }
  };

  const resetUpload = () => {
    setInputMode('pdf');
    setOriginalFile(null);
    setManualForm({ full_name: '', phone_number: '', email: '', skills: '', experience: '', education: '' });
    setStatus('idle');
    setResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto mt-6 bg-slate-50 p-6 rounded-2xl min-h-screen">
      <div className="mb-8 flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Smart Candidate Ingestion</h2>
            <p className="text-slate-500 mt-1 text-sm">Upload a CV. The AI will parse it locally for review before saving.</p>
        </div>
      </div>

      <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Target Regional Hub</label>
        <select 
          value={selectedHub} onChange={(e) => setSelectedHub(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 outline-none"
        >
          {AUF_HUBS.map(hub => <option key={hub} value={hub}>{hub}</option>)}
        </select>
      </div>

      {inputMode === 'pdf' && status === 'idle' && (
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-16 flex flex-col items-center justify-center text-center cursor-pointer bg-white transition-all ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}`}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 mb-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            </div>
            <p className="text-lg font-medium text-slate-700">Drag and drop a CV here to auto-parse</p>
            <p className="text-sm text-slate-400 mt-2">The text will be extracted and sorted into reviewable sections instantly.</p>
            
            <button onClick={(e) => { e.stopPropagation(); setInputMode('review'); }} className="mt-6 text-sm text-blue-600 hover:underline">
              Skip upload and enter data manually
            </button>
          </div>
      )}

      {inputMode === 'review' && status !== 'success' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Verify Parsed Data</h3>
                {originalFile && <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">Source: {originalFile.name}</span>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                      <input type="text" name="full_name" value={manualForm.full_name} onChange={e => setManualForm({...manualForm, full_name: e.target.value})} className="w-full border p-2 rounded focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                      <input type="email" name="email" value={manualForm.email} onChange={e => setManualForm({...manualForm, email: e.target.value})} className="w-full border p-2 rounded focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                      <input type="tel" name="phone_number" value={manualForm.phone_number} onChange={e => setManualForm({...manualForm, phone_number: e.target.value})} className="w-full border p-2 rounded focus:ring-blue-500 outline-none" />
                  </div>
              </div>

              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Key Skills & Competencies</label>
                      <textarea name="skills" value={manualForm.skills} onChange={e => setManualForm({...manualForm, skills: e.target.value})} rows="3" className="w-full border p-2 rounded focus:ring-blue-500 outline-none"></textarea>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Professional Experience</label>
                      <textarea name="experience" value={manualForm.experience} onChange={e => setManualForm({...manualForm, experience: e.target.value})} rows="5" className="w-full border p-2 rounded focus:ring-blue-500 outline-none"></textarea>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Education Background</label>
                      <textarea name="education" value={manualForm.education} onChange={e => setManualForm({...manualForm, education: e.target.value})} rows="3" className="w-full border p-2 rounded focus:ring-blue-500 outline-none"></textarea>
                  </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                  <button onClick={resetUpload} className="px-5 py-2 rounded-md font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                  <button onClick={handleUploadSmart} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md font-medium shadow-sm flex items-center">
                    {status === 'processing' ? 'Indexing...' : 'Save to Database'}
                  </button>
              </div>
          </div>
      )}

      {status === 'success' && result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center mt-6">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h3 className="text-xl font-bold text-green-800 mb-2">Profile Ingested Successfully</h3>
          <p className="text-green-700 mb-6">Database Vector ID: {result.vector_id}</p>
          <button onClick={resetUpload} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm">
            Ingest Another Candidate
          </button>
        </div>
      )}

      {errorMsg && status === 'error' && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {errorMsg}
        </div>
      )}
    </div>
  );
};

export default UploadView;