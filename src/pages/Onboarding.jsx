import { useState, useRef } from 'react';
import { ArrowRight, Upload, Check, AlertCircle } from 'lucide-react';
import { analyzeLAMalPolicy } from '../services/claude';
import { saveLamalPolicy } from '../services/supabase';

function Onboarding({ onComplete, userId }) {
    // step: 'welcome' | 'upload' | 'analysis' | 'franchise' | 'model' | 'complete'
    const [step, setStep] = useState('welcome');
    const [animating, setAnimating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const fileInputRef = useRef(null);

    // LAMal data
    const [lamalData, setLamalData] = useState(null);

    // Franchise logic
    const [expenseInputs, setExpenseInputs] = useState({
        visitesMedecin: 2,
        medicaments: 0,
        physiotherapie: 0,
        hospitalisationPrevue: false,
        lunettes: false,
        autresFrais: 0
    });
    const [riskAccepted, setRiskAccepted] = useState(null);
    const [budgetMax, setBudgetMax] = useState(3200);

    // Constantes
    const FRANCHISES = [300, 500, 1000, 1500, 2500];
    const QUOTE_PART_MAX = 700;

    const calculateExpenses = () => {
        let total = 0;
        total += expenseInputs.visitesMedecin * 150;
        total += expenseInputs.medicaments * 12;
        total += expenseInputs.physiotherapie * 120;
        if (expenseInputs.hospitalisationPrevue) total += 2000;
        if (expenseInputs.lunettes) total += 400;
        total += expenseInputs.autresFrais;
        return total;
    };

    const getRecommendedFranchise = (expenses) => {
        if (expenses > 1900) return 300;
        return 2500;
    };

    const getMaxOutOfPocket = (franchise) => franchise + QUOTE_PART_MAX;

    const getFranchiseForBudget = (budget) => {
        for (let i = FRANCHISES.length - 1; i >= 0; i--) {
            if (getMaxOutOfPocket(FRANCHISES[i]) <= budget) {
                return FRANCHISES[i];
            }
        }
        return 300;
    };

    const handleStart = () => {
        setAnimating(true);
        setTimeout(() => {
            setAnimating(false);
            setStep('upload');
        }, 500);
    };

    const handleUpload = async (file) => {
        setUploading(true);
        setUploadError(null);

        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result;
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const mediaType = file.type || 'application/pdf';
            const result = await analyzeLAMalPolicy(base64, mediaType);

            setLamalData({
                assureur: result.assureur || 'Inconnu',
                produit: result.produit || '',
                franchise: result.franchise || 0,
                modele: result.modele || 'standard',
                modele_description: result.modele_description || '',
                medecin_reference: result.medecin_reference || null,
                prime_mensuelle: result.prime_mensuelle || 0,
                region: result.region_tarifaire || ''
            });
            setStep('analysis');
        } catch (error) {
            console.error('Erreur upload:', error);
            setUploadError(error.message || 'Erreur lors de l\'analyse');
        } finally {
            setUploading(false);
        }
    };

    const handleComplete = async () => {
        setAnimating(true);

        // Sauvegarder les données LAMal dans Supabase
        if (userId && lamalData) {
            try {
                await saveLamalPolicy(userId, {
                    assureur: lamalData.assureur,
                    produit: lamalData.produit,
                    franchise: lamalData.franchise,
                    modele: lamalData.modele,
                    prime_mensuelle: lamalData.prime_mensuelle,
                    region: lamalData.region,
                    medecin_reference: lamalData.medecin_reference,
                    franchise_recommandee: riskAccepted === false
                        ? getFranchiseForBudget(budgetMax)
                        : getRecommendedFranchise(calculateExpenses()),
                    risk_accepted: riskAccepted
                });
            } catch (error) {
                console.error('Erreur sauvegarde:', error);
            }
        }

        setTimeout(() => {
            onComplete();
        }, 500);
    };

    // Render based on step
    const renderStep = () => {
        switch (step) {
            case 'welcome':
                return (
                    <div className={`onboarding ${animating ? 'fade-out' : ''}`}>
                        <div className="onboarding-content">
                            <div className="onboarding-logo-container">
                                <img
                                    src="https://res.cloudinary.com/ddfxgecpo/image/upload/v1765293709/logo_text_250_coral_mwwlwi.png"
                                    alt="Jane"
                                    className="onboarding-logo pulse"
                                />
                            </div>
                            <p className="onboarding-slogan">
                                Reprendre le contrôle de ses assurances
                            </p>
                            <button className="onboarding-btn" onClick={handleStart}>
                                Go <ArrowRight size={20} />
                            </button>
                        </div>
                    </div>
                );

            case 'upload':
                return (
                    <div className="onboarding-page tech-page">
                        {/* Titre minimaliste */}
                        <div className="tech-header">
                            <h1>Uploade ta police LAMal</h1>
                        </div>

                        {/* Zone d'upload épurée */}
                        <div
                            className="upload-zone-tech"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
                                onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])}
                            />
                            {uploading ? (
                                <>
                                    <div className="spinner-tech"></div>
                                    <div className="upload-text-tech">Analyse en cours...</div>
                                </>
                            ) : (
                                <>
                                    <div className="upload-icon-tech">
                                        <Upload size={32} strokeWidth={1.5} />
                                    </div>
                                    <div className="upload-text-tech">PDF ou image</div>
                                </>
                            )}
                        </div>

                        {uploadError && (
                            <div className="tech-error">
                                <AlertCircle size={16} />
                                <span>{uploadError}</span>
                            </div>
                        )}

                        {/* Animation des 3 étapes */}
                        <div className="tech-steps">
                            <div className="tech-step step-1">
                                <div className="step-number">1</div>
                                <div className="step-text">Analyse de ton contrat</div>
                            </div>
                            <div className="tech-step step-2">
                                <div className="step-number">2</div>
                                <div className="step-text">Check de tes besoins</div>
                            </div>
                            <div className="tech-step step-3">
                                <div className="step-number">3</div>
                                <div className="step-text">Optimisation globale</div>
                            </div>
                        </div>
                    </div>
                );

            case 'analysis':
                return (
                    <div className="onboarding-page">
                        <div className="onboarding-header">
                            <span className="onboarding-step-badge">Analyse terminée ✓</span>
                            <h1>Ta LAMal actuelle</h1>
                        </div>

                        <div className="sante-card">
                            <div className="sante-card-header">
                                <span className="sante-card-icon">📋</span>
                                <h3>{lamalData.assureur}</h3>
                            </div>
                            <div className="sante-info-grid">
                                {lamalData.produit && (
                                    <div className="sante-info-item">
                                        <span className="sante-info-label">Produit</span>
                                        <span className="sante-info-value">{lamalData.produit}</span>
                                    </div>
                                )}
                                <div className="sante-info-item">
                                    <span className="sante-info-label">Prime/mois</span>
                                    <span className="sante-info-value" style={{ fontWeight: '600', color: 'var(--accent-coral)' }}>
                                        {typeof lamalData.prime_mensuelle === 'number'
                                            ? lamalData.prime_mensuelle.toFixed(2)
                                            : lamalData.prime_mensuelle} CHF
                                    </span>
                                </div>
                                <div className="sante-info-item">
                                    <span className="sante-info-label">Franchise/an</span>
                                    <span className="sante-info-value">{lamalData.franchise.toLocaleString('fr-CH')} CHF</span>
                                </div>
                                <div className="sante-info-item">
                                    <span className="sante-info-label">Modèle</span>
                                    <span className="sante-info-value" style={{ textTransform: 'capitalize' }}>
                                        {lamalData.modele === 'medecin_famille' ? 'Médecin de famille' :
                                            lamalData.modele === 'standard' ? 'Standard' : lamalData.modele}
                                    </span>
                                </div>
                            </div>
                            {lamalData.medecin_reference && (
                                <div style={{ marginTop: '12px', padding: '12px', background: 'var(--sandlight)', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        👨‍⚕️ Médecin : <strong>{lamalData.medecin_reference}</strong>
                                    </span>
                                </div>
                            )}
                        </div>

                        <button className="btn btn-primary btn-full" onClick={() => setStep('franchise')}>
                            Optimiser ma LAMal <ArrowRight size={18} />
                        </button>
                    </div>
                );

            case 'franchise':
                const expenses = calculateExpenses();
                const recommendedFranchise = getRecommendedFranchise(expenses);
                const needsHighFranchise = expenses <= 1900;
                const maxRisk2500 = getMaxOutOfPocket(2500);
                const finalRecommendedFranchise = riskAccepted === false
                    ? getFranchiseForBudget(budgetMax)
                    : recommendedFranchise;

                return (
                    <div className="onboarding-page">
                        <div className="onboarding-header">
                            <span className="onboarding-step-badge">Étape 2/3</span>
                            <h1>Ta franchise</h1>
                            <p>Vérifions si ta franchise est adaptée.</p>
                        </div>

                        {/* Calculateur */}
                        <div className="sante-card">
                            <div className="sante-card-header">
                                <span className="sante-card-icon">🧮</span>
                                <h3>Tes frais de santé annuels</h3>
                            </div>

                            <div className="sante-calculator">
                                <div className="calc-row">
                                    <label>Visites médecin/an</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={expenseInputs.visitesMedecin}
                                        onChange={(e) => setExpenseInputs({ ...expenseInputs, visitesMedecin: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="calc-row">
                                    <label>Médicaments/mois (CHF)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={expenseInputs.medicaments}
                                        onChange={(e) => setExpenseInputs({ ...expenseInputs, medicaments: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="calc-row checkbox">
                                    <label>Hospitalisation prévue</label>
                                    <input
                                        type="checkbox"
                                        checked={expenseInputs.hospitalisationPrevue}
                                        onChange={(e) => setExpenseInputs({ ...expenseInputs, hospitalisationPrevue: e.target.checked })}
                                    />
                                </div>
                                <div className="calc-total">
                                    <span>Frais estimés</span>
                                    <span className="calc-total-value">{expenses.toLocaleString('fr-CH')} CHF/an</span>
                                </div>
                            </div>
                        </div>

                        {/* Recommandation franchise */}
                        {!needsHighFranchise && (
                            <div className="sante-alert warning">
                                <AlertCircle size={20} />
                                <div>
                                    <strong>Franchise 300 CHF recommandée</strong>
                                    <p>Avec {expenses.toLocaleString('fr-CH')} CHF de frais, une franchise basse te protège mieux.</p>
                                </div>
                            </div>
                        )}

                        {needsHighFranchise && riskAccepted === null && (
                            <div className="sante-card" style={{ background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)' }}>
                                <div className="sante-card-header">
                                    <span className="sante-card-icon">⚠️</span>
                                    <h3>Franchise 2'500 CHF recommandée</h3>
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                    En cas de pépin, tu pourrais payer jusqu'à <strong>{maxRisk2500.toLocaleString('fr-CH')} CHF</strong>.
                                </p>
                                <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>
                                    Peux-tu assumer ce risque ?
                                </p>
                                <div className="sante-choice-buttons">
                                    <button className="sante-choice-btn" onClick={() => setRiskAccepted(true)} style={{ flex: 1 }}>
                                        <span className="choice-icon">✅</span>
                                        <span>Oui</span>
                                    </button>
                                    <button className="sante-choice-btn" onClick={() => setRiskAccepted(false)} style={{ flex: 1 }}>
                                        <span className="choice-icon">❌</span>
                                        <span>Non</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {needsHighFranchise && riskAccepted === false && (
                            <div className="sante-card">
                                <div className="sante-card-header">
                                    <span className="sante-card-icon">💰</span>
                                    <h3>Budget maximum ?</h3>
                                </div>
                                <input
                                    type="range"
                                    min="1000"
                                    max="3200"
                                    step="100"
                                    value={budgetMax}
                                    onChange={(e) => setBudgetMax(parseInt(e.target.value))}
                                    style={{ width: '100%', accentColor: 'var(--coral-red)' }}
                                />
                                <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', marginTop: '8px' }}>
                                    {budgetMax.toLocaleString('fr-CH')} CHF
                                </div>
                                <div className="sante-alert success" style={{ marginTop: '16px' }}>
                                    <Check size={20} />
                                    <div>
                                        <strong>Franchise recommandée : {getFranchiseForBudget(budgetMax).toLocaleString('fr-CH')} CHF</strong>
                                    </div>
                                </div>
                            </div>
                        )}

                        {needsHighFranchise && riskAccepted === true && (
                            <div className="sante-alert success">
                                <Check size={20} />
                                <div><strong>Franchise 2'500 CHF confirmée</strong></div>
                            </div>
                        )}

                        <button
                            className="btn btn-primary btn-full"
                            onClick={() => setStep('model')}
                            disabled={needsHighFranchise && riskAccepted === null}
                        >
                            Continuer <ArrowRight size={18} />
                        </button>
                    </div>
                );

            case 'model':
                return (
                    <div className="onboarding-page">
                        <div className="onboarding-header">
                            <span className="onboarding-step-badge">Étape 3/3</span>
                            <h1>Ton modèle d'assurance</h1>
                        </div>

                        <div className="sante-card">
                            <div className="sante-card-header">
                                <span className="sante-card-icon">🏥</span>
                                <h3>Modèle actuel : {lamalData.modele === 'medecin_famille' ? 'Médecin de famille' : lamalData.modele}</h3>
                            </div>

                            {lamalData.modele === 'standard' ? (
                                <div>
                                    <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                                        Tu peux économiser en passant à un modèle alternatif :
                                    </p>
                                    <div className="sante-model-options">
                                        <div className="model-option">
                                            <strong>Médecin de famille</strong>
                                            <span className="model-savings">~10-15% d'économie</span>
                                        </div>
                                        <div className="model-option">
                                            <strong>HMO</strong>
                                            <span className="model-savings">~15-25% d'économie</span>
                                        </div>
                                        <div className="model-option">
                                            <strong>Telmed</strong>
                                            <span className="model-savings">~10-20% d'économie</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="sante-alert success">
                                    <Check size={20} />
                                    <span>Tu bénéficies déjà d'un modèle économique !</span>
                                </div>
                            )}
                        </div>

                        <button className="btn btn-primary btn-full" onClick={handleComplete}>
                            Terminer <ArrowRight size={18} />
                        </button>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className={`app ${step === 'welcome' ? '' : 'onboarding-flow'} ${animating ? 'fade-out' : ''}`}>
            {renderStep()}
        </div>
    );
}

export default Onboarding;
