import { useState, useEffect } from 'react';
import { ChevronRight, X, Plus, Camera, Upload } from 'lucide-react';
import { getPolicies } from '../services/storage';
import { detectIssues } from '../services/claude';

function Cockpit({ onNavigate }) {
    const [policies, setPolicies] = useState([]);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedModal, setSelectedModal] = useState(null);
    const [showAddMenu, setShowAddMenu] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const storedPolicies = getPolicies();
        setPolicies(storedPolicies);

        if (storedPolicies.length > 0) {
            try {
                const result = await detectIssues(storedPolicies);
                setAnalysis(result);
            } catch (error) {
                console.error('Erreur analyse:', error);
            }
        }
        setLoading(false);
    };

    const totalPremium = policies.reduce((sum, p) => sum + (p.prime_mensuelle || 0), 0);
    const avgScore = policies.length > 0
        ? Math.round(policies.reduce((sum, p) => sum + (p.score_qualite || 0), 0) / policies.length)
        : 0;
    const alertCount = analysis?.alertes?.length || 0;

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <span>Analyse en cours...</span>
            </div>
        );
    }

    return (
        <div className="cockpit">
            {/* Greeting */}
            <div className="cockpit-greeting">
                <h1>Salut,<br />Comment puis-je t'aider ?</h1>
            </div>

            {/* Action Grid - Bento Style (without Scanner) */}
            <div className="action-grid">
                {/* Polices */}
                <div
                    className="action-card white"
                    onClick={() => setSelectedModal({ title: 'Mes polices', desc: `Tu as ${policies.length} police${policies.length > 1 ? 's' : ''} enregistrée${policies.length > 1 ? 's' : ''}.` })}
                >
                    <div className="action-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <path d="M14 2v6h6" />
                            <path d="M16 13H8" />
                            <path d="M16 17H8" />
                        </svg>
                    </div>
                    <span className="action-label">Polices</span>
                    <span className="action-value">{policies.length}</span>
                </div>

                {/* Primes */}
                <div
                    className="action-card yellow"
                    onClick={() => setSelectedModal({ title: 'Primes', desc: `Tu paies ${totalPremium.toLocaleString('fr-CH')} CHF/mois, soit ${(totalPremium * 12).toLocaleString('fr-CH')} CHF/an.` })}
                >
                    <div className="action-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="4" width="22" height="16" rx="2" />
                            <line x1="1" y1="10" x2="23" y2="10" />
                        </svg>
                    </div>
                    <span className="action-label">CHF/mois</span>
                    <span className="action-value">{totalPremium.toLocaleString('fr-CH', { minimumFractionDigits: 0 })}</span>
                </div>

                {/* Ask AI - Large */}
                <div
                    className="action-card action-card-large green"
                    onClick={() => onNavigate && onNavigate('chat')}
                >
                    <div className="action-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                    <span className="action-label">Demander à l'IA</span>
                </div>

                {/* Score */}
                <div
                    className="action-card purple"
                    onClick={() => setSelectedModal({ title: 'Score', desc: `Ton score: ${analysis?.score_global || avgScore}/100.` })}
                >
                    <div className="action-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </div>
                    <span className="action-label">Score</span>
                    <span className="action-value">{analysis?.score_global || avgScore || '—'}</span>
                </div>

                {/* Alerts */}
                <div
                    className="action-card coral"
                    onClick={() => setSelectedModal({ title: 'Alertes', desc: alertCount > 0 ? `${alertCount} alerte${alertCount > 1 ? 's' : ''} détectée${alertCount > 1 ? 's' : ''}.` : 'Aucune alerte.' })}
                >
                    <div className="action-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <span className="action-label">Alertes</span>
                    <span className="action-value">{alertCount}</span>
                </div>
            </div>

            {/* Search Bar */}
            <div className="search-bar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" placeholder="Rechercher ou demander..." readOnly />
            </div>

            {/* Floating Action Button */}
            <button className="fab" onClick={() => setShowAddMenu(true)}>
                <Plus size={28} strokeWidth={2.5} />
            </button>

            {/* Add Menu Modal */}
            {showAddMenu && (
                <div className="modal-overlay" onClick={() => setShowAddMenu(false)}>
                    <div className="modal add-menu-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-handle"></div>
                        <h2 className="modal-title">Ajouter une police</h2>
                        <p className="modal-text" style={{ marginBottom: '20px' }}>Comment veux-tu ajouter ta police ?</p>

                        <div className="add-menu-options">
                            <button className="add-menu-option" onClick={() => { setShowAddMenu(false); onNavigate && onNavigate('assurances'); }}>
                                <div className="add-menu-icon blue">
                                    <Camera size={24} />
                                </div>
                                <div>
                                    <div className="add-menu-option-title">Scanner</div>
                                    <div className="add-menu-option-desc">Prendre une photo du document</div>
                                </div>
                            </button>

                            <button className="add-menu-option" onClick={() => { setShowAddMenu(false); onNavigate && onNavigate('assurances'); }}>
                                <div className="add-menu-icon green">
                                    <Upload size={24} />
                                </div>
                                <div>
                                    <div className="add-menu-option-title">Uploader</div>
                                    <div className="add-menu-option-desc">Sélectionner un fichier PDF</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Modal */}
            {selectedModal && (
                <div className="modal-overlay" onClick={() => setSelectedModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-handle"></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <h2 className="modal-title">{selectedModal.title}</h2>
                            <button onClick={() => setSelectedModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <p className="modal-text">{selectedModal.desc}</p>
                        <button className="btn btn-primary" onClick={() => setSelectedModal(null)} style={{ width: '100%', marginTop: '24px' }}>
                            Compris
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Cockpit;
