import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import UploadView from './components/UploadView';
import SearchView from './components/SearchView';
import ProfileView from './components/ProfileView';

// Wrapper component to handle the Profile View routing
import { useNavigate } from 'react-router-dom';
const SearchViewWithNavigation = () => {
  const navigate = useNavigate();
  return <SearchView onViewProfile={(id) => navigate(`/profile/${id}`)} />;
};

const ProfileViewWithNavigation = () => {
  const navigate = useNavigate();
  // Extract the ID from the URL path manually for simplicity, or use useParams
  const id = window.location.pathname.split('/').pop();
  return <ProfileView cvId={id} onBack={() => navigate('/search')} />;
};

function App() {
  return (
    <Router>
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<UploadView />} />
          <Route path="/search" element={<SearchViewWithNavigation />} />
          <Route path="/profile/:id" element={<ProfileViewWithNavigation />} />
        </Routes>
      </DashboardLayout>
    </Router>
  );
}

export default App;