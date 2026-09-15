import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { isAuthenticated, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const dashboardPath = profile && profile.role === 'patient' ? '/dashboard' : '/portal';

  const navLink = (to, label) => (
    <Link
      to={to}
      onClick={() => setMenuOpen(false)}
      className={`text-[15px] transition-colors duration-150 ${
        location.pathname === to ? 'text-ink font-medium' : 'text-muted hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b border-hairline bg-paper sticky top-0 z-40">
      <div className="max-w-content mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-display text-xl text-ink" onClick={() => setMenuOpen(false)}>
          EzRemedy
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {isAuthenticated ? (
            <>
              {navLink(dashboardPath, profile && profile.role === 'patient' ? 'Dashboard' : 'Portal')}
              <span className="text-sm text-faint">{profile ? profile.full_name : ''}</span>
              <button onClick={handleSignOut} className="btn-secondary py-2 px-4 text-sm">
                Sign out
              </button>
            </>
          ) : (
            <>
              {navLink('/login', 'Sign in')}
              <Link to="/register" className="btn-primary py-2 px-4 text-sm">
                Get started
              </Link>
            </>
          )}
        </nav>

        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="w-6 h-px bg-ink" />
          <span className="w-6 h-px bg-ink" />
          <span className="w-6 h-px bg-ink" />
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden border-t border-hairline overflow-hidden"
          >
            <div className="max-w-content mx-auto px-6 py-4 flex flex-col gap-4">
              {isAuthenticated ? (
                <>
                  {navLink(dashboardPath, profile && profile.role === 'patient' ? 'Dashboard' : 'Portal')}
                  <button onClick={handleSignOut} className="btn-secondary py-2 px-4 text-sm w-fit">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  {navLink('/login', 'Sign in')}
                  {navLink('/register', 'Get started')}
                </>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
