import { useState, useEffect } from 'react';
import { Users, FileText, TrendingUp, ArrowLeft, RefreshCw, Mail, Calendar, Shield } from 'lucide-react';
import { supabase } from '../services/supabase';

function Admin({ onBack }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPolicies: 0,
    recentSignups: 0
  });
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPolicy, setUserPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get all user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get all policies
      const { data: policies, error: policiesError } = await supabase
        .from('lamal_policies')
        .select('*');

      if (policiesError) throw policiesError;

      // Calculate stats
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentUsers = profiles?.filter(p => new Date(p.created_at) > weekAgo) || [];

      setStats({
        totalUsers: profiles?.length || 0,
        totalPolicies: policies?.length || 0,
        recentSignups: recentUsers.length
      });

      // Merge profiles with policies
      const usersWithPolicies = profiles?.map(profile => {
        const policy = policies?.find(p => p.user_id === profile.user_id);
        return { ...profile, hasPolicy: !!policy };
      }) || [];

      setUsers(usersWithPolicies);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPolicy = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('lamal_policies')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setUserPolicy(data);
    } catch (error) {
      console.error('Error loading user policy:', error);
      setUserPolicy(null);
    }
  };

  const handleUserClick = async (user) => {
    setSelectedUser(user);
    await loadUserPolicy(user.user_id);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" style={{ width: 32, height: 32 }}></div>
        <p>Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header">
        <button className="admin-back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
          <span>Retour</span>
        </button>
        <h1 className="admin-title">
          <Shield size={24} />
          Panneau Admin
        </h1>
        <button className="admin-refresh-btn" onClick={loadData}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <TrendingUp size={16} />
          Dashboard
        </button>
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} />
          Utilisateurs
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="admin-dashboard">
          <div className="stat-card">
            <div className="stat-icon users">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalUsers}</span>
              <span className="stat-label">Utilisateurs</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon policies">
              <FileText size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.totalPolicies}</span>
              <span className="stat-label">Polices LAMal</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon recent">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.recentSignups}</span>
              <span className="stat-label">Nouveaux (7j)</span>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && !selectedUser && (
        <div className="admin-users-list">
          {users.length === 0 ? (
            <div className="admin-empty">
              <Users size={48} />
              <p>Aucun utilisateur inscrit</p>
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="user-card"
                onClick={() => handleUserClick(user)}
              >
                <div className="user-avatar">
                  {(user.first_name?.[0] || user.user_id?.[0] || '?').toUpperCase()}
                </div>
                <div className="user-info">
                  <span className="user-name">
                    {user.first_name && user.last_name
                      ? `${user.first_name} ${user.last_name}`
                      : 'Utilisateur'}
                  </span>
                  <span className="user-meta">
                    {user.canton || 'Canton non défini'} • {formatDate(user.created_at)}
                  </span>
                </div>
                <div className={`user-status ${user.hasPolicy ? 'complete' : 'pending'}`}>
                  {user.hasPolicy ? '✓' : '○'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* User Detail */}
      {activeTab === 'users' && selectedUser && (
        <div className="user-detail">
          <button
            className="user-detail-back"
            onClick={() => {
              setSelectedUser(null);
              setUserPolicy(null);
            }}
          >
            <ArrowLeft size={16} />
            Retour à la liste
          </button>

          <div className="user-detail-header">
            <div className="user-detail-avatar">
              {(selectedUser.first_name?.[0] || '?').toUpperCase()}
            </div>
            <h2>
              {selectedUser.first_name && selectedUser.last_name
                ? `${selectedUser.first_name} ${selectedUser.last_name}`
                : 'Utilisateur'}
            </h2>
          </div>

          <div className="user-detail-section">
            <h3>Profil</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <Mail size={14} />
                <span className="detail-label">User ID:</span>
                <span className="detail-value">{selectedUser.user_id?.slice(0, 8)}...</span>
              </div>
              <div className="detail-item">
                <Calendar size={14} />
                <span className="detail-label">Inscrit le:</span>
                <span className="detail-value">{formatDate(selectedUser.created_at)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Canton:</span>
                <span className="detail-value">{selectedUser.canton || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Date de naissance:</span>
                <span className="detail-value">{formatDate(selectedUser.birth_date)}</span>
              </div>
            </div>
          </div>

          {userPolicy && (
            <div className="user-detail-section">
              <h3>Police LAMal</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Assureur:</span>
                  <span className="detail-value">{userPolicy.assureur || userPolicy.insurer_name || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Produit:</span>
                  <span className="detail-value">{userPolicy.produit || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Franchise:</span>
                  <span className="detail-value">{userPolicy.franchise ? `${userPolicy.franchise} CHF` : '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Modèle:</span>
                  <span className="detail-value">{userPolicy.modele || userPolicy.model || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Prime mensuelle:</span>
                  <span className="detail-value">
                    {userPolicy.prime_mensuelle || userPolicy.monthly_premium
                      ? `${userPolicy.prime_mensuelle || userPolicy.monthly_premium} CHF`
                      : '-'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!userPolicy && (
            <div className="user-detail-section">
              <h3>Police LAMal</h3>
              <p className="no-policy">Aucune police enregistrée</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Admin;
