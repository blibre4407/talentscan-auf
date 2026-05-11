import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const UploadView = () => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [loadingText, setLoadingText] = useState('');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // UX Trick: Cycle through loading texts to expose the AI process
  useEffect(() => {
    let timeout1, timeout2;
    if (status === 'processing') {
      setLoadingText('Extracting raw text from PDF...');
      timeout1 = setTimeout(() => {
        setLoadingText('Cleaning data and tokenizing...');
      }, 1500);
      timeout2 = setTimeout(() => {
        setLoadingText('Generating 384-dimensional vector embeddings...');
      }, 3500);
    }
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [status]);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      setFile(acceptedFiles[0]);
      setStatus('idle');
      setResult(null);
      setErrorMsg('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file) return;

    setStatus('processing');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
      setStatus('success');
      setFile(null); // Clear file for the next upload
    } catch (error) {
      console.error('Upload failed:', error);
      setStatus('error');
      setErrorMsg(error.response?.data?.detail || 'An error occurred during indexing.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-4">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Candidate Ingestion Zone</h2>
        <p className="text-slate-500 mt-1 text-sm">
          Securely upload candidate CVs to the vector database. Files are instantly parsed and embedded into the mathematical space.
        </p>
      </div>

      {/* Massive Drag & Drop Zone */}
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-xl p-16 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer ${
          isDragReject ? 'border-red-500 bg-red-50' :
          isDragActive ? 'border-institutional-accent bg-blue-50' : 
          'border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        {isDragActive ? (
          <p className="text-lg font-medium text-institutional-accent">Drop the PDF to begin ingestion...</p>
        ) : (
          <div>
            <p className="text-lg font-medium text-slate-700">Drag and drop a CV here, or click to browse</p>
            <p className="text-sm text-slate-400 mt-2">Supports .PDF formats only. Maximum file size 10MB.</p>
          </div>
        )}
      </div>

      {/* Processing Queue & Actions */}
      {file && status !== 'processing' && (
        <div className="mt-6 bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center">
            <svg className="w-8 h-8 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button 
            onClick={handleUpload}
            className="bg-institutional-blue hover:bg-blue-800 text-white px-5 py-2 rounded-md font-medium transition-colors text-sm shadow-sm"
          >
            Start Vectorization
          </button>
        </div>
      )}

      {/* Dynamic Processing State */}
      {status === 'processing' && (
        <div className="mt-6 bg-white border border-blue-200 rounded-lg p-6 flex flex-col items-center justify-center shadow-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-institutional-accent mb-4"></div>
          <p className="text-slate-800 font-medium animate-pulse">{loadingText}</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden">
            <div className="bg-institutional-accent h-1.5 rounded-full w-full animate-pulse"></div>
          </div>
        </div>
      )}

      {/* Success State */}
      {status === 'success' && result && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-5 flex items-start">
          <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-green-800">System Indexed Successfully</h4>
            <div className="mt-1 text-sm text-green-700 flex flex-col space-y-1">
              <span>Database ID: <span className="font-mono bg-green-100 px-1 rounded">{result.id}</span></span>
              <span>FAISS Vector ID: <span className="font-mono bg-green-100 px-1 rounded">{result.vector_id}</span></span>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          {errorMsg}
        </div>
      )}
    </div>
  );
};

export default UploadView;