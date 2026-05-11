import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const DashboardLayout = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Ingestion Zone', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
    { path: '/search', label: 'Matching Engine', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Persistent Left Sidebar */}
      <aside className="w-64 bg-institutional-blue text-white flex flex-col shadow-xl z-10">
        <div className="h-16 flex items-center px-6 border-b border-blue-800 bg-blue-950">
          <span className="text-xl font-bold tracking-wider">TalentScan</span>
        </div>
        
        <nav className="flex-1 py-6 space-y-2 px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-institutional-accent text-white font-medium shadow-md' 
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-800 text-xs text-blue-300 text-center">
          PFE System © 2026
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-0">
          <h1 className="text-xl font-semibold text-slate-800 capitalize">
            {location.pathname === '/' ? 'Candidate Ingestion' : 'AI Matching Engine'}
          </h1>
          <div className="flex items-center text-sm font-medium text-slate-600">
            <div className="w-8 h-8 rounded-full bg-institutional-light text-institutional-blue flex items-center justify-center mr-3 border border-blue-100">
              AD
            </div>
            System Admin
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;