import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Work from './pages/Work.jsx';
import TaskDetail from './pages/TaskDetail.jsx';
import Chat from './pages/Chat.jsx';
import Machines from './pages/Machines.jsx';
import Notifications from './pages/Notifications.jsx';
import Overview from './pages/Overview.jsx';
import Organizations from './pages/Organizations.jsx';
import Users from './pages/Users.jsx';
import Announcements from './pages/Announcements.jsx';

const SUPPORT_NAV = [
  { to: 'work', label: 'Scheduled work', icon: '🗓' },
  { to: 'messages', label: 'Messages', icon: '💬' },
  { to: 'machines', label: 'Machines', icon: '🧺' },
  { to: 'notifications', label: 'Notifications', icon: '🔔' },
];
const SUPER_NAV = [
  { to: 'overview', label: 'Overview', icon: '📊' },
  { to: 'organizations', label: 'Organizations', icon: '🏢' },
  { to: 'users', label: 'Users', icon: '👥' },
  { to: 'machines', label: 'Machines', icon: '🧺' },
  { to: 'announcements', label: 'Announcements', icon: '📣' },
  { to: 'notifications', label: 'Notifications', icon: '🔔' },
];

// Area for one role: the login page when signed out, the area itself when signed in as that role.
function Area({ role, base, title, nav, home, children }) {
  const { user, logout } = useAuth();
  if (!user) return <Login role={role} base={base} />;
  if (user.role_key !== role) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Wrong area</h1>
          <p className="muted">You are signed in as {user.email}, which can't use this page.</p>
          <button className="btn btn-primary btn-block" onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }
  return (
    <Routes>
      <Route element={<Layout title={title} base={base} nav={nav} />}>
        {children}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/support/*"
        element={
          <Area role="support_refund_agent" base="/support" title="Customer support" nav={SUPPORT_NAV} home="/support/work">
            <Route path="work" element={<Work />} />
            <Route path="tasks/:id" element={<TaskDetail />} />
            <Route path="messages" element={<Chat />} />
            <Route path="machines" element={<Machines />} />
            <Route path="notifications" element={<Notifications />} />
          </Area>
        }
      />
      <Route
        path="/super/*"
        element={
          <Area role="super_admin" base="/super" title="Super admin" nav={SUPER_NAV} home="/super/overview">
            <Route path="overview" element={<Overview />} />
            <Route path="organizations" element={<Organizations />} />
            <Route path="users" element={<Users />} />
            <Route path="machines" element={<Machines />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="notifications" element={<Notifications />} />
          </Area>
        }
      />
      <Route path="*" element={<Navigate to="/support" replace />} />
    </Routes>
  );
}
