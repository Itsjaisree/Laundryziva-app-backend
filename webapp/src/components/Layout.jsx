import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// Sidebar + top bar shared by the support and super admin areas.
export default function Layout({ title, base, nav }) {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">Lz</span>
          <div>
            <div className="brand-name">Laundryziva</div>
            <div className="brand-sub">{title}</div>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <NavLink key={item.to} to={`${base}/${item.to}`} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <div className="who-avatar">{(user?.name || user?.email || '?').charAt(0).toUpperCase()}</div>
            <div className="who-text">
              <div className="who-name">{user?.name || 'User'}</div>
              <div className="who-mail">{user?.email}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-block" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
