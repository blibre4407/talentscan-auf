import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import UploadView from './components/UploadView';
import SearchView from './components/SearchView';
import ProfileView from './components/ProfileView';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex fixed h-full z-10">
          <div className="h-16 flex items-center px-6 border-b border-slate-200">
            <h1 className="text-xl font-bold text-institutional-blue">TalentScan-AUF</h1>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            <Link to="/" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50">
              Semantic Search
            </Link>
            <Link to="/upload" className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50">
              Ingest Candidates
            </Link>
          </nav>
        </aside>
        
        {/* Main Content Area */}
        <main className="flex-1 md:ml-64 p-8">
          <Routes>
            <Route path="/" element={<SearchView />} />
            <Route path="/upload" element={<UploadView />} />
            <Route path="/profile/:id" element={<ProfileView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
export default App;