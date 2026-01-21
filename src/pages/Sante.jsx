import { useState, useRef } from 'react';
import { ChevronRight, Upload, X, Check, AlertCircle, Calculator, ArrowRight } from 'lucide-react';
import { analyzeLAMalPolicy } from '../services/claude';

function Sante() {
    const [step, setStep] = useState('intro'); // intro, lamal-upload, lamal-analysis, lamal-franchise, lamal-model, complementaires, recommendations, summary
    const [lamalData, setLamalData] = useState(null);
    const [complementairesData, setComplementairesData] = useState([]);
    const [expenseInputs, setExpenseInputs] = useState({
        visitesMedecin: 2,
        medicaments: 0,
        physiotherapie: 0,
        hospitalisationPrevue: false,
        lunettes: false,
        autresFrais: 0
    });
    const [needs, setNeeds] = useState({
        cliniquePrive: null,
        voyages: null,
        medecinesAlternatives: null,
        dentaire: null
    });
    const [recommendations, setRecommendations] = useState([]);
    const [todos, setTodos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [riskAccepted, setRiskAccepted] = useState(null); // null = pas encore demandé, true/false
    const [budgetMax, setBudgetMax] = useState(3200); // Budget max que l'utilisateur peut débourser
    const fileInputRef = useRef(null);

    // Constantes franchise suisse
    const FRANCHISES = [300, 500, 1000, 1500, 2500];
    const QUOTE_PART_MAX = 700; // 10% jusqu'à 7000 CHF de frais

    // Estimation des frais annuels
    const calculateExpenses = () => {
        let total = 0;
        total += expenseInputs.visitesMedecin * 150; // ~150 CHF par visite
        total += expenseInputs.medicaments * 12; // mensuel → annuel
        total += expenseInputs.physiotherapie * 120; // ~120 CHF par séance
        if (expenseInputs.hospitalisationPrevue) total += 2000;
        if (expenseInputs.lunettes) total += 400;
        total += expenseInputs.autresFrais;
        return total;
    };

    // Recommandation franchise selon la nouvelle logique
    // 1. Si frais > 1900 CHF → franchise 300 CHF
    // 2. Sinon → franchise 2500 CHF (mais vérifier si le risque est acceptable)
    const getRecommendedFranchise = (expenses) => {
        if (expenses > 1900) return 300;
        return 2500;
    };

    // Calcul du coût max de poche (franchise + quote-part)
    const getMaxOutOfPocket = (franchise) => franchise + QUOTE_PART_MAX;

    // Recommandation franchise basée sur le budget disponible
    const getFranchiseForBudget = (budget) => {
        // Trouve la franchise la plus haute dont le risque max est <= budget
        for (let i = FRANCHISES.length - 1; i >= 0; i--) {
            if (getMaxOutOfPocket(FRANCHISES[i]) <= budget) {
                return FRANCHISES[i];
            }
        }
        return 300; // Si budget très bas, recommander 300
    };

    // Analyse réelle du document LAMal via API Claude
    const handleLamalUpload = async (file) => {
        setUploading(true);
        setUploadError(null);

        try {
            // Convertir le fichier en base64
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result;
                    // Extraire seulement la partie base64 (après "data:...;base64,")
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // Déterminer le type MIME
            const mediaType = file.type || 'application/pdf';

            // Appeler l'API Claude pour analyser
            const result = await analyzeLAMalPolicy(base64, mediaType);

            // Mapper les résultats au format attendu par le composant
            setLamalData({
                assureur: result.assureur || 'Inconnu',
                produit: result.produit || '',
                franchise: result.franchise || 0,
                modele: result.modele || 'standard',
                modele_description: result.modele_description || '',
                medecin_reference: result.medecin_reference || null,
                prime_mensuelle: result.prime_mensuelle || 0,
                prime_brute: result.prime_brute || 0,
                deductions: result.deductions || 0,
                region: result.region_tarifaire || '',
                date_debut: result.date_debut || '',
                date_fin: result.date_fin || '',
                couvertures: result.couvertures || [],
                accident_inclus: result.accident_inclus || false,
                resume: result.resume || ''
            });
            setStep('lamal-analysis');
        } catch (error) {
            console.error('Erreur upload LAMal:', error);
            setUploadError(error.message || 'Erreur lors de l\'analyse du document');
        } finally {
            setUploading(false);
        }
    };

    // Rendu par étape
    const renderStep = () => {
        switch (step) {
            case 'intro':
                return (
                    <div className="sante-intro">
                        <div className="sante-hero">
                            <span className="sante-hero-icon">🏥</span>
                            <h2>Check Assurance Maladie</h2>
                            <p>Vérifions ensemble que tu as les bonnes couvertures au meilleur prix.</p>
                        </div>

                        <div className="sante-steps-preview">
                            <div className="sante-step-item">
                                <span className="sante-step-number">1</span>
                                <span>Analyse LAMal</span>
                            </div>
                            <div className="sante-step-item">
                                <span className="sante-step-number">2</span>
                                <span>Complémentaires</span>
                            </div>
                            <div className="sante-step-item">
                                <span className="sante-step-number">3</span>
                                <span>Recommandations</span>
                            </div>
                        </div>

                        <button className="btn btn-primary btn-full" onClick={() => setStep('lamal-upload')}>
                            Commencer le check <ArrowRight size={18} />
                        </button>
                    </div>
                );

            case 'lamal-upload':
                return (
                    <div className="sante-section">
                        <div className="sante-section-header">
                            <span className="sante-section-badge">Étape 1/3</span>
                            <h2>Assurance de base (LAMal)</h2>
                            <p>Uploade ta police d'assurance maladie de base pour l'analyser.</p>
                        </div>

                        <div
                            className="upload-zone"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
                                onChange={(e) => e.target.files[0] && handleLamalUpload(e.target.files[0])}
                            />
                            {uploading ? (
                                <>
                                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                                    <div className="upload-text">Analyse en cours...</div>
                                    <div className="upload-subtext">L'IA analyse ton document</div>
                                </>
                            ) : (
                                <>
                                    <div className="upload-icon">
                                        <Upload size={24} />
                                    </div>
                                    <div className="upload-text">Police LAMal</div>
                                    <div className="upload-subtext">PDF ou image (PNG, JPG)</div>
                                </>
                            )}
                        </div>

                        {uploadError && (
                            <div className="sante-alert warning" style={{ marginTop: '16px' }}>
                                <AlertCircle size={20} />
                                <div>
                                    <strong>Erreur d'analyse</strong>
                                    <p>{uploadError}</p>
                                </div>
                            </div>
                        )}

                        <button className="btn btn-secondary btn-full" onClick={() => setStep('intro')}>
                            Retour
                        </button>
                    </div>
                );

            case 'lamal-analysis':
                return (
                    <div className="sante-section">
                        <div className="sante-section-header">
                            <span className="sante-section-badge">Analyse terminée ✓</span>
                            <h2>Ta LAMal actuelle</h2>
                        </div>

                        {/* Résumé police */}
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
                                            lamalData.modele === 'standard' ? 'Standard (libre choix)' : lamalData.modele}
                                    </span>
                                </div>
                                {lamalData.region && (
                                    <div className="sante-info-item">
                                        <span className="sante-info-label">Région</span>
                                        <span className="sante-info-value">{lamalData.region}</span>
                                    </div>
                                )}
                            </div>
                            {lamalData.medecin_reference && (
                                <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        👨‍⚕️ Médecin de référence : <strong>{lamalData.medecin_reference}</strong>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Question optimisation */}
                        <div className="sante-card" style={{ background: 'linear-gradient(135deg, var(--card-green) 0%, #e8f5e9 100%)' }}>
                            <div className="sante-card-header">
                                <span className="sante-card-icon">💡</span>
                                <h3>Souhaites-tu optimiser ta LAMal ?</h3>
                            </div>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                Nous pouvons vérifier si ta franchise et ton modèle d'assurance sont adaptés à tes besoins.
                            </p>
                            <div className="sante-choice-buttons">
                                <button
                                    className="sante-choice-btn"
                                    onClick={() => setStep('lamal-franchise')}
                                    style={{ flex: 1 }}
                                >
                                    <span className="choice-icon">✅</span>
                                    <span>Oui, optimiser</span>
                                </button>
                                <button
                                    className="sante-choice-btn"
                                    onClick={() => setStep('complementaires')}
                                    style={{ flex: 1 }}
                                >
                                    <span className="choice-icon">➡️</span>
                                    <span>Non, continuer</span>
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case 'lamal-franchise':
                const expenses = calculateExpenses();
                const recommendedFranchise = getRecommendedFranchise(expenses);
                const needsHighFranchise = expenses <= 1900; // Recommande 2500 CHF
                const maxRisk2500 = getMaxOutOfPocket(2500); // 3200 CHF
                const finalRecommendedFranchise = riskAccepted === false
                    ? getFranchiseForBudget(budgetMax)
                    : recommendedFranchise;
                const franchiseOptimal = lamalData.franchise === finalRecommendedFranchise;

                return (
                    <div className="sante-section">
                        <div className="sante-section-header">
                            <span className="sante-section-badge">Optimisation 1/2</span>
                            <h2>Ta franchise</h2>
                            <p>Vérifions si ta franchise est adaptée à ta situation.</p>
                        </div>

                        {/* Franchise actuelle */}
                        <div className="sante-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ta franchise actuelle</span>
                                <span style={{ fontSize: '24px', fontWeight: '700' }}>{lamalData.franchise.toLocaleString('fr-CH')} CHF</span>
                            </div>
                        </div>

                        {/* Calculateur de frais */}
                        <div className="sante-card">
                            <div className="sante-card-header">
                                <span className="sante-card-icon">🧮</span>
                                <h3>Tes frais de santé annuels</h3>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                Estime combien tu dépenses en moyenne par an.
                            </p>

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
                                <div className="calc-row">
                                    <label>Séances physio/an</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={expenseInputs.physiotherapie}
                                        onChange={(e) => setExpenseInputs({ ...expenseInputs, physiotherapie: parseInt(e.target.value) || 0 })}
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
                                <div className="calc-row checkbox">
                                    <label>Nouvelles lunettes prévues</label>
                                    <input
                                        type="checkbox"
                                        checked={expenseInputs.lunettes}
                                        onChange={(e) => setExpenseInputs({ ...expenseInputs, lunettes: e.target.checked })}
                                    />
                                </div>
                                <div className="calc-row">
                                    <label>Autres frais estimés</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={expenseInputs.autresFrais}
                                        onChange={(e) => setExpenseInputs({ ...expenseInputs, autresFrais: parseInt(e.target.value) || 0 })}
                                    />
                                </div>

                                <div className="calc-total">
                                    <span>Frais estimés</span>
                                    <span className="calc-total-value">{expenses.toLocaleString('fr-CH')} CHF/an</span>
                                </div>
                            </div>
                        </div>

                        {/* Si frais > 1900 CHF → Recommander 300 CHF */}
                        {!needsHighFranchise && (
                            <div className="sante-alert warning">
                                <AlertCircle size={20} />
                                <div>
                                    <strong>Franchise 300 CHF recommandée</strong>
                                    <p>Avec {expenses.toLocaleString('fr-CH')} CHF de frais estimés, tu vas dépasser ta franchise. Une franchise de <strong>300 CHF</strong> te permettra d'être mieux couvert.</p>
                                </div>
                            </div>
                        )}

                        {/* Si frais <= 1900 CHF → Proposer 2500 CHF avec avertissement risque */}
                        {needsHighFranchise && riskAccepted === null && (
                            <div className="sante-card" style={{ background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)' }}>
                                <div className="sante-card-header">
                                    <span className="sante-card-icon">⚠️</span>
                                    <h3>Franchise 2'500 CHF recommandée</h3>
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                    Avec moins de 1'900 CHF de frais estimés, une franchise haute te permet d'économiser sur ta prime.
                                </p>
                                <div style={{ background: 'rgba(255,152,0,0.15)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                                    <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                                        💡 Important : En cas de gros pépin de santé, tu pourrais devoir débourser jusqu'à :
                                    </p>
                                    <p style={{ fontSize: '24px', fontWeight: '700', color: 'var(--accent-coral)' }}>
                                        {maxRisk2500.toLocaleString('fr-CH')} CHF
                                    </p>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                        (2'500 CHF de franchise + 700 CHF de quote-part max)
                                    </p>
                                </div>
                                <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>
                                    Peux-tu assumer ce risque ?
                                </p>
                                <div className="sante-choice-buttons">
                                    <button
                                        className="sante-choice-btn"
                                        onClick={() => setRiskAccepted(true)}
                                        style={{ flex: 1 }}
                                    >
                                        <span className="choice-icon">✅</span>
                                        <span>Oui, je peux</span>
                                    </button>
                                    <button
                                        className="sante-choice-btn"
                                        onClick={() => setRiskAccepted(false)}
                                        style={{ flex: 1 }}
                                    >
                                        <span className="choice-icon">❌</span>
                                        <span>Non, c'est trop</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Si risque accepté → Confirmer 2500 CHF */}
                        {needsHighFranchise && riskAccepted === true && (
                            <div className="sante-alert success">
                                <Check size={20} />
                                <div>
                                    <strong>Franchise 2'500 CHF confirmée</strong>
                                    <p>Tu pourras économiser sur ta prime mensuelle tout en acceptant le risque de débourser jusqu'à {maxRisk2500.toLocaleString('fr-CH')} CHF si besoin.</p>
                                </div>
                            </div>
                        )}

                        {/* Si risque refusé → Curseur pour budget max */}
                        {needsHighFranchise && riskAccepted === false && (
                            <div className="sante-card">
                                <div className="sante-card-header">
                                    <span className="sante-card-icon">💰</span>
                                    <h3>Quel montant peux-tu débourser maximum ?</h3>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                    Indique le montant maximum que tu pourrais payer de ta poche en cas de gros problème de santé.
                                </p>

                                <div style={{ marginBottom: '16px' }}>
                                    <input
                                        type="range"
                                        min="1000"
                                        max="3200"
                                        step="100"
                                        value={budgetMax}
                                        onChange={(e) => setBudgetMax(parseInt(e.target.value))}
                                        style={{ width: '100%', accentColor: 'var(--accent-coral)' }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        <span>1'000 CHF</span>
                                        <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{budgetMax.toLocaleString('fr-CH')} CHF</span>
                                        <span>3'200 CHF</span>
                                    </div>
                                </div>

                                <div className="sante-alert success">
                                    <Check size={20} />
                                    <div>
                                        <strong>Franchise recommandée : {getFranchiseForBudget(budgetMax).toLocaleString('fr-CH')} CHF</strong>
                                        <p>Avec cette franchise, tu ne débourseras pas plus de {getMaxOutOfPocket(getFranchiseForBudget(budgetMax)).toLocaleString('fr-CH')} CHF même en cas de gros pépin.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Comparaison avec franchise actuelle */}
                        {(riskAccepted !== null || !needsHighFranchise) && (
                            <>
                                {franchiseOptimal ? (
                                    <div className="sante-alert success">
                                        <Check size={20} />
                                        <div>
                                            <strong>Ta franchise actuelle est optimale !</strong>
                                            <p>Ta franchise de {lamalData.franchise.toLocaleString('fr-CH')} CHF correspond à notre recommandation.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="sante-alert warning">
                                        <AlertCircle size={20} />
                                        <div>
                                            <strong>Changement recommandé</strong>
                                            <p>
                                                Ta franchise actuelle est de {lamalData.franchise.toLocaleString('fr-CH')} CHF.
                                                Nous te recommandons <strong>{finalRecommendedFranchise.toLocaleString('fr-CH')} CHF</strong> pour l'année prochaine.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <button
                            className="btn btn-primary btn-full"
                            onClick={() => setStep('lamal-model')}
                            disabled={needsHighFranchise && riskAccepted === null}
                        >
                            Continuer <ArrowRight size={18} />
                        </button>
                    </div>
                );

            case 'lamal-model':
                return (
                    <div className="sante-section">
                        <div className="sante-section-header">
                            <span className="sante-section-badge">Optimisation 2/2</span>
                            <h2>Ton modèle d'assurance</h2>
                            <p>Vérifions si ton modèle est adapté à tes habitudes.</p>
                        </div>

                        <div className="sante-card">
                            <div className="sante-card-header">
                                <span className="sante-card-icon">🏥</span>
                                <h3>Ton modèle actuel : {lamalData.modele}</h3>
                            </div>

                            {lamalData.modele === 'standard' ? (
                                <div className="sante-model-info">
                                    <p><strong>Modèle Standard</strong> : Tu peux consulter n'importe quel médecin directement, sans restriction.</p>
                                    <p className="text-muted">C'est le modèle le plus flexible mais aussi le plus cher.</p>

                                    <h4>Alternatives pour économiser :</h4>
                                    <div className="sante-model-options">
                                        <div className="model-option">
                                            <strong>Médecin de famille</strong>
                                            <p>Tu consultes d'abord ton médecin traitant</p>
                                            <span className="model-savings">~10-15% d'économie</span>
                                        </div>
                                        <div className="model-option">
                                            <strong>HMO</strong>
                                            <p>Tu passes par un centre médical</p>
                                            <span className="model-savings">~15-25% d'économie</span>
                                        </div>
                                        <div className="model-option">
                                            <strong>Telmed</strong>
                                            <p>Tu appelles une hotline avant de consulter</p>
                                            <span className="model-savings">~10-20% d'économie</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="sante-model-info">
                                    <p><strong>Modèle {lamalData.modele}</strong> : Tu bénéficies déjà d'un modèle alternatif qui réduit ta prime.</p>
                                    <div className={`sante-alert success`}>
                                        <Check size={20} />
                                        <span>Très bien ! Ce modèle te permet d'économiser sur ta prime.</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="sante-card">
                            <p><strong>📅 Rappel :</strong> En novembre 2026, nous vérifierons si la tarification de {lamalData.assureur} reste compétitive pour 2027.</p>
                        </div>

                        <button className="btn btn-primary btn-full" onClick={() => setStep('complementaires')}>
                            Passer aux complémentaires <ArrowRight size={18} />
                        </button>
                    </div>
                );

            case 'complementaires':
                return (
                    <div className="sante-section">
                        <div className="sante-section-header">
                            <span className="sante-section-badge">Étape 2/3</span>
                            <h2>Assurances complémentaires</h2>
                            <p>As-tu des assurances complémentaires (hospitalisation, ambulatoire, dentaire...) ?</p>
                        </div>

                        <div className="sante-choice-buttons">
                            <button
                                className="sante-choice-btn"
                                onClick={() => setStep('complementaires-questions')}
                            >
                                <span className="choice-icon">❌</span>
                                <span>Non, je n'en ai pas</span>
                            </button>
                            <button
                                className="sante-choice-btn"
                                onClick={() => setStep('complementaires-upload')}
                            >
                                <span className="choice-icon">✅</span>
                                <span>Oui, j'en ai</span>
                            </button>
                        </div>
                    </div>
                );

            case 'complementaires-questions':
                return (
                    <div className="sante-section">
                        <div className="sante-section-header">
                            <span className="sante-section-badge">Étape 2/3</span>
                            <h2>Tes besoins</h2>
                            <p>Quelques questions pour identifier si des complémentaires seraient utiles.</p>
                        </div>

                        <div className="sante-questions">
                            <div className="sante-question">
                                <p>En cas d'hospitalisation, souhaites-tu être en <strong>clinique privée</strong> (chambre individuelle, choix du médecin) ?</p>
                                <div className="question-btns">
                                    <button
                                        className={`q-btn ${needs.cliniquePrive === true ? 'active' : ''}`}
                                        onClick={() => setNeeds({ ...needs, cliniquePrive: true })}
                                    >Oui</button>
                                    <button
                                        className={`q-btn ${needs.cliniquePrive === false ? 'active' : ''}`}
                                        onClick={() => setNeeds({ ...needs, cliniquePrive: false })}
                                    >Non</button>
                                </div>
                            </div>

                            <div className="sante-question">
                                <p>Voyages-tu souvent <strong>à l'étranger</strong> ?</p>
                                <div className="question-btns">
                                    <button
                                        className={`q-btn ${needs.voyages === true ? 'active' : ''}`}
                                        onClick={() => setNeeds({ ...needs, voyages: true })}
                                    >Oui</button>
                                    <button
                                        className={`q-btn ${needs.voyages === false ? 'active' : ''}`}
                                        onClick={() => setNeeds({ ...needs, voyages: false })}
                                    >Non</button>
                                </div>
                            </div>

                            <div className="sante-question">
                                <p>Utilises-tu des <strong>médecines alternatives</strong> (ostéo, acupuncture, naturopathie) ?</p>
                                <div className="question-btns">
                                    <button
                                        className={`q-btn ${needs.medecinesAlternatives === true ? 'active' : ''}`}
                                        onClick={() => setNeeds({ ...needs, medecinesAlternatives: true })}
                                    >Oui</button>
                                    <button
                                        className={`q-btn ${needs.medecinesAlternatives === false ? 'active' : ''}`}
                                        onClick={() => setNeeds({ ...needs, medecinesAlternatives: false })}
                                    >Non</button>
                                </div>
                            </div>

                            <div className="sante-question">
                                <p>As-tu besoin de <strong>soins dentaires</strong> importants ?</p>
                                <div className="question-btns">
                                    <button
                                        className={`q-btn ${needs.dentaire === true ? 'active' : ''}`}
                                        onClick={() => setNeeds({ ...needs, dentaire: true })}
                                    >Oui</button>
                                    <button
                                        className={`q-btn ${needs.dentaire === false ? 'active' : ''}`}
                                        onClick={() => setNeeds({ ...needs, dentaire: false })}
                                    >Non</button>
                                </div>
                            </div>
                        </div>

                        <button
                            className="btn btn-primary btn-full"
                            onClick={() => {
                                // Générer recommandations basées sur besoins
                                const recs = [];
                                if (needs.cliniquePrive) recs.push({ type: 'hospitalisation_privee', text: 'Assurance hospitalisation privée recommandée' });
                                if (needs.voyages) recs.push({ type: 'voyage', text: 'Assurance voyage/assistance à l\'étranger recommandée' });
                                if (needs.medecinesAlternatives) recs.push({ type: 'ambulatoire', text: 'Assurance ambulatoire (médecines alternatives) recommandée' });
                                if (needs.dentaire) recs.push({ type: 'dentaire', text: 'Assurance dentaire recommandée' });
                                setRecommendations(recs);
                                setStep('recommendations');
                            }}
                            disabled={Object.values(needs).some(v => v === null)}
                        >
                            Voir mes recommandations <ArrowRight size={18} />
                        </button>
                    </div>
                );

            case 'recommendations':
                const monthlyPremiumEstimate = recommendations.length * 40; // ~40 CHF/mois par complémentaire
                const cashback = monthlyPremiumEstimate * 0.15 * 12; // 15% annuel

                return (
                    <div className="sante-section">
                        <div className="sante-section-header">
                            <span className="sante-section-badge">Étape 3/3</span>
                            <h2>Mes recommandations</h2>
                        </div>

                        {recommendations.length === 0 ? (
                            <div className="sante-card">
                                <div className="sante-alert success">
                                    <Check size={20} />
                                    <div>
                                        <strong>Aucune complémentaire nécessaire</strong>
                                        <p>D'après tes réponses, tu n'as pas besoin de complémentaires pour le moment.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="sante-card">
                                    <p className="text-muted" style={{ marginBottom: '16px' }}>Basé sur tes réponses, voici ce que je te recommande :</p>

                                    {recommendations.map((rec, i) => (
                                        <div key={i} className="recommendation-item">
                                            <div className="rec-icon">💡</div>
                                            <div>
                                                <strong>{rec.text}</strong>
                                                <p className="text-muted">Souhaites-tu que je recherche la meilleure offre ?</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {cashback > 0 && (
                                    <div className="sante-cashback">
                                        <div className="cashback-header">
                                            <span>💰</span>
                                            <h3>Cashback estimé avec JANE+</h3>
                                        </div>
                                        <div className="cashback-amount">{cashback.toFixed(0)} CHF/an</div>
                                        <p>15% des primes rétrocédées sur les nouveaux contrats</p>
                                    </div>
                                )}
                            </>
                        )}

                        <button className="btn btn-primary btn-full" onClick={() => setStep('summary')}>
                            Terminer le check <ArrowRight size={18} />
                        </button>
                    </div>
                );

            case 'summary':
                return (
                    <div className="sante-section">
                        <div className="sante-hero" style={{ background: 'var(--card-green)' }}>
                            <span className="sante-hero-icon">✅</span>
                            <h2>Check terminé !</h2>
                            <p>Voici le résumé de ton analyse.</p>
                        </div>

                        <div className="sante-card">
                            <h3>📋 Actions à faire</h3>
                            <div className="todos-list">
                                {calculateExpenses() > 2000 && lamalData.franchise > 300 && (
                                    <div className="todo-item high">
                                        <span className="todo-badge">Priorité haute</span>
                                        <p>Changer ta franchise à 300 CHF pour 2027</p>
                                    </div>
                                )}
                                {lamalData.modele === 'standard' && (
                                    <div className="todo-item medium">
                                        <span className="todo-badge">Recommandé</span>
                                        <p>Considérer un modèle alternatif (HMO, Telmed)</p>
                                    </div>
                                )}
                                <div className="todo-item normal">
                                    <span className="todo-badge">Novembre 2026</span>
                                    <p>Vérifier les tarifs {lamalData.assureur} pour 2027</p>
                                </div>
                                {recommendations.map((rec, i) => (
                                    <div key={i} className="todo-item medium">
                                        <span className="todo-badge">Complémentaire</span>
                                        <p>{rec.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button className="btn btn-primary btn-full" onClick={() => setStep('intro')}>
                            Retour à l'accueil
                        </button>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="sante-page">
            {renderStep()}
        </div>
    );
}

export default Sante;
