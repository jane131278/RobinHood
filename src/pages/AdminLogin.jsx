import { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, User } from 'lucide-react';

// Admin credentials from environment variables
const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'jane2026';

function AdminLogin({ onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Simple delay to simulate authentication
        setTimeout(() => {
            if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                // Store admin session in sessionStorage (cleared when browser closes)
                sessionStorage.setItem('adminAuthenticated', 'true');
                onLoginSuccess();
            } else {
                setError('Identifiants incorrects');
            }
            setLoading(false);
        }, 500);
    };

    return (
        <div className="admin-login-container">
            <div className="admin-login-card">
                <div className="admin-login-header">
                    <div className="admin-login-icon">
                        <Shield size={32} />
                    </div>
                    <h1>Accès Admin</h1>
                    <p>Connectez-vous pour accéder au panneau d'administration</p>
                </div>

                <form onSubmit={handleSubmit} className="admin-login-form">
                    <div className="admin-input-group">
                        <label htmlFor="username">
                            <User size={16} />
                            Nom d'utilisateur
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Entrez votre nom d'utilisateur"
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div className="admin-input-group">
                        <label htmlFor="password">
                            <Lock size={16} />
                            Mot de passe
                        </label>
                        <div className="password-input-wrapper">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Entrez votre mot de passe"
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="admin-login-error">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="admin-login-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="spinner" style={{ width: 20, height: 20 }}></div>
                        ) : (
                            <>
                                <Lock size={18} />
                                Se connecter
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default AdminLogin;
