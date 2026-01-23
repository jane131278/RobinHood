import { useState, useEffect } from 'react';
import { Home, FileText, MessageCircle, Heart, Wallet, X, LogOut, Shield } from 'lucide-react';
import Cockpit from './pages/Cockpit';
import MesAssurances from './pages/MesAssurances';
import Chat from './pages/Chat';
import Sante from './pages/Sante';
import Onboarding from './pages/Onboarding';
import Auth from './pages/Auth';
import Admin from './pages/Admin';
import AdminLogin from './pages/AdminLogin';
import { supabase, signOut, getCurrentUser } from './services/supabase';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [currentPage, setCurrentPage] = useState('cockpit');
  const [showWallet, setShowWallet] = useState(false);
  // Check if accessing /admin via URL
  const [showAdmin, setShowAdmin] = useState(window.location.pathname === '/admin');
  // Admin authentication state
  const [adminAuthenticated, setAdminAuthenticated] = useState(
    sessionStorage.getItem('adminAuthenticated') === 'true'
  );

  // Check auth state on mount
  useEffect(() => {
    // Get initial session
    getCurrentUser().then((user) => {
      setUser(user);
      if (user) {
        // Check if user has completed onboarding (has lamal data)
        checkOnboardingStatus(user.id);
      }
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkOnboardingStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkOnboardingStatus = async (userId) => {
    try {
      const { data } = await supabase
        .from('lamal_policies')
        .select('id')
        .eq('user_id', userId)
        .single();
      setHasCompletedOnboarding(!!data);
    } catch {
      setHasCompletedOnboarding(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setHasCompletedOnboarding(false);
  };

  const handleOnboardingComplete = async () => {
    setHasCompletedOnboarding(true);
  };

  // Wallet data - in real app this would come from API/storage
  const walletData = {
    totalCommissions: 127.50,
    transactions: [
      { id: 1, date: '2026-01-15', description: 'Commission Bâloise Auto', amount: 45.00 },
      { id: 2, date: '2026-01-10', description: 'Commission Swiss Life 3a', amount: 62.50 },
      { id: 3, date: '2025-12-20', description: 'Commission Groupe Mutuel', amount: 20.00 },
    ]
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'cockpit':
        return <Cockpit onNavigate={setCurrentPage} />;
      case 'assurances':
        return <MesAssurances />;
      case 'sante':
        return <Sante />;
      case 'chat':
        return <Chat />;
      default:
        return <Cockpit onNavigate={setCurrentPage} />;
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="spinner" style={{ width: 32, height: 32 }}></div>
      </div>
    );
  }

  // Not logged in → show Auth
  if (!user) {
    return <Auth onAuthSuccess={(u) => setUser(u)} />;
  }

  // Show Admin panel (accessible even without onboarding)
  if (showAdmin) {
    return <Admin onBack={() => {
      setShowAdmin(false);
      // Update URL when leaving admin
      window.history.pushState({}, '', '/');
    }} />;
  }

  // Logged in but hasn't completed onboarding → show Onboarding
  if (!hasCompletedOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} userId={user.id} />;
  }

  // Logged in and onboarding completed → show App
  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <img
          src="https://res.cloudinary.com/ddfxgecpo/image/upload/v1765293709/logo_text_250_coral_mwwlwi.png"
          alt="JANE+"
          className="logo-img"
        />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="wallet-btn" onClick={() => setShowWallet(true)}>
            <Wallet size={16} />
            <span>{walletData.totalCommissions.toFixed(2)} CHF</span>
          </button>
          <button
            className="wallet-btn"
            onClick={() => setShowAdmin(true)}
            style={{ background: 'var(--card-purple)', padding: '10px' }}
            title="Admin"
          >
            <Shield size={16} />
          </button>
          <button
            className="wallet-btn"
            onClick={handleLogout}
            style={{ background: 'var(--sandlight)', padding: '10px' }}
            title="Déconnexion"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {renderPage()}
      </main>

      {/* Bottom Navigation - 4 items */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${currentPage === 'cockpit' ? 'active' : ''}`}
          onClick={() => setCurrentPage('cockpit')}
        >
          <Home size={20} />
        </button>
        <button
          className={`nav-item ${currentPage === 'sante' ? 'active' : ''}`}
          onClick={() => setCurrentPage('sante')}
        >
          <Heart size={20} />
        </button>
        <button
          className={`nav-item ${currentPage === 'assurances' ? 'active' : ''}`}
          onClick={() => setCurrentPage('assurances')}
        >
          <FileText size={20} />
        </button>
        <button
          className={`nav-item ${currentPage === 'chat' ? 'active' : ''}`}
          onClick={() => setCurrentPage('chat')}
        >
          <MessageCircle size={20} />
        </button>
      </nav>

      {/* Wallet Modal */}
      {showWallet && (
        <div className="modal-overlay" onClick={() => setShowWallet(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle"></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="modal-title">💰 Mon Wallet</h2>
              <button onClick={() => setShowWallet(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="wallet-balance">
              <span className="wallet-balance-label">Commissions rétrocédées</span>
              <span className="wallet-balance-amount">{walletData.totalCommissions.toFixed(2)} CHF</span>
            </div>

            <p className="wallet-info">
              JANE te rétrocède une partie des commissions perçues sur tes contrats. 🎉
            </p>

            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', marginTop: '20px' }}>Historique</h3>
            <div className="wallet-transactions">
              {walletData.transactions.map(tx => (
                <div key={tx.id} className="wallet-tx">
                  <div>
                    <div className="wallet-tx-desc">{tx.description}</div>
                    <div className="wallet-tx-date">{new Date(tx.date).toLocaleDateString('fr-CH')}</div>
                  </div>
                  <div className="wallet-tx-amount">+{tx.amount.toFixed(2)} CHF</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
