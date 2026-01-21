import { useState } from 'react';
import { ArrowRight, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { signIn, signUp } from '../services/supabase';

function Auth({ onAuthSuccess }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (mode === 'register') {
                if (password !== confirmPassword) {
                    throw new Error('Les mots de passe ne correspondent pas');
                }
                if (password.length < 6) {
                    throw new Error('Le mot de passe doit contenir au moins 6 caractères');
                }
                await signUp(email, password);
                // Supabase sends confirmation email by default
                setError({ type: 'success', message: 'Vérifie ton email pour confirmer ton compte !' });
            } else {
                const { user } = await signIn(email, password);
                if (user) {
                    onAuthSuccess(user);
                }
            }
        } catch (err) {
            setError({ type: 'error', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                {/* Logo */}
                <div className="auth-logo">
                    <img
                        src="https://res.cloudinary.com/ddfxgecpo/image/upload/v1765293709/logo_text_250_coral_mwwlwi.png"
                        alt="Jane"
                    />
                </div>

                {/* Title */}
                <h1 className="auth-title">
                    {mode === 'login' ? 'Connexion' : 'Créer un compte'}
                </h1>

                {/* Form */}
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-input-group">
                        <Mail size={18} className="auth-input-icon" />
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="auth-input"
                        />
                    </div>

                    <div className="auth-input-group">
                        <Lock size={18} className="auth-input-icon" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Mot de passe"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="auth-input"
                        />
                        <button
                            type="button"
                            className="auth-toggle-password"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {mode === 'register' && (
                        <div className="auth-input-group">
                            <Lock size={18} className="auth-input-icon" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Confirmer le mot de passe"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="auth-input"
                            />
                        </div>
                    )}

                    {error && (
                        <div className={`auth-message ${error.type}`}>
                            <AlertCircle size={16} />
                            <span>{error.message}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="auth-submit-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="spinner" style={{ width: 20, height: 20 }}></div>
                        ) : (
                            <>
                                {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                {/* Toggle mode */}
                <div className="auth-toggle">
                    {mode === 'login' ? (
                        <p>
                            Pas encore de compte ?{' '}
                            <button onClick={() => setMode('register')}>
                                Créer un compte
                            </button>
                        </p>
                    ) : (
                        <p>
                            Déjà un compte ?{' '}
                            <button onClick={() => setMode('login')}>
                                Se connecter
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Auth;
