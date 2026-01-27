import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Check, HelpCircle, Minus, Plus, Upload, FileText, AlertCircle, TrendingDown, ArrowRight } from 'lucide-react';
import insuranceData from '../data/swiss-insurance-2026.json';
import { analyzeLAMalPolicy } from '../services/claude';

// Canton options
const CANTONS = [
  { code: 'GE', name: 'Genève' },
  { code: 'VD', name: 'Vaud' },
  { code: 'VS', name: 'Valais' },
  { code: 'FR', name: 'Fribourg' },
  { code: 'NE', name: 'Neuchâtel' },
  { code: 'JU', name: 'Jura' },
  { code: 'BE', name: 'Berne' },
  { code: 'ZH', name: 'Zurich' },
  { code: 'BS', name: 'Bâle-Ville' },
  { code: 'BL', name: 'Bâle-Campagne' },
  { code: 'AG', name: 'Argovie' },
  { code: 'SO', name: 'Soleure' },
  { code: 'LU', name: 'Lucerne' },
  { code: 'ZG', name: 'Zoug' },
  { code: 'SG', name: 'Saint-Gall' },
  { code: 'TG', name: 'Thurgovie' },
  { code: 'TI', name: 'Tessin' },
  { code: 'GR', name: 'Grisons' },
  { code: 'SZ', name: 'Schwytz' },
  { code: 'NW', name: 'Nidwald' },
  { code: 'OW', name: 'Obwald' },
  { code: 'UR', name: 'Uri' },
  { code: 'GL', name: 'Glaris' },
  { code: 'SH', name: 'Schaffhouse' },
  { code: 'AR', name: 'Appenzell RE' },
  { code: 'AI', name: 'Appenzell RI' }
];

// Average costs for calculations
const COSTS = {
  consultationGeneraliste: 120,
  consultationSpecialiste: 200,
  urgences: 350,
  analyseLabo: 80,
  radioEcho: 150,
  irmCt: 800,
  seanceTherapie: 120,
};

const THERAPY_OPTIONS = ['Physio', 'Ostéo', 'Chiro', 'Psy', 'Ergo', 'Autre'];
const EVENT_OPTIONS = ['Hospitalisation', 'Chirurgie', 'Accouchement', 'Traitement long', 'Dentaire', 'Lunettes', 'Autre'];

// Tooltip component
const Tooltip = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="tooltip-wrapper">
      <span className="tooltip-trigger" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onClick={() => setShow(!show)}>
        <HelpCircle size={14} />
      </span>
      {show && <div className="tooltip-content">{text}</div>}
    </span>
  );
};

// Number stepper
const NumberStepper = ({ value, onChange, min = 0, max = 50, label }) => (
  <div className="number-stepper">
    <span className="stepper-label">{label}</span>
    <div className="stepper-controls">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="stepper-btn"><Minus size={16} /></button>
      <span className="stepper-value">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="stepper-btn"><Plus size={16} /></button>
    </div>
  </div>
);

const ToggleButton = ({ selected, onClick, children }) => (
  <button onClick={onClick} className={`toggle-btn ${selected ? 'selected' : ''}`}>{children}</button>
);

const Chip = ({ selected, onClick, children }) => (
  <button onClick={onClick} className={`chip ${selected ? 'selected' : ''}`}>{children}</button>
);

function Sante() {
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [extractedPolicy, setExtractedPolicy] = useState(null);

  const [formData, setFormData] = useState({
    // Extracted from policy
    birthDate: '',
    canton: 'GE',
    region: '0',
    currentInsurer: '',
    currentProduct: '',
    currentPremium: 0,
    currentFranchise: 300,
    currentModel: 'standard',
    hasAccident: true,
    // Medical costs questionnaire
    consultationsGeneraliste: 0,
    consultationsSpecialiste: 0,
    urgences: 0,
    hasMedicaments: null,
    medicamentsCost: 50,
    analysesLabo: 0,
    radioEcho: 0,
    irmCt: 0,
    hasTherapie: null,
    therapieTypes: [],
    therapieSeances: 0,
    hasEvenementCouteux: null,
    evenementTypes: [],
    evenementMontant: 0,
    // Calculated
    estimatedCosts: 0,
    recommendedFranchise: null,
    financialCapacity: null,
    selectedFranchise: null,
    // Model selection
    acceptedConstraints: [],
    selectedModel: null,
    // Accident
    worksOver8h: null,
    withAccident: null,
  });

  const getAgeClass = (birthDate) => {
    if (!birthDate) return 'adult';
    const birth = new Date(birthDate);
    const reference = new Date('2026-01-01');
    const age = reference.getFullYear() - birth.getFullYear();
    if (age <= 18) return 'child';
    if (age >= 19 && age <= 25) return 'youngAdult';
    return 'adult';
  };

  const ageClass = getAgeClass(formData.birthDate);
  const ageClassLabels = { child: 'Enfant (0-18)', youngAdult: 'Jeune adulte (19-25)', adult: 'Adulte (26+)' };

  const calculateEstimatedCosts = () => {
    let total = 0;
    total += formData.consultationsGeneraliste * COSTS.consultationGeneraliste;
    total += formData.consultationsSpecialiste * COSTS.consultationSpecialiste;
    total += formData.urgences * COSTS.urgences;
    if (formData.hasMedicaments === 'oui') total += formData.medicamentsCost * 12;
    total += formData.analysesLabo * COSTS.analyseLabo;
    total += formData.radioEcho * COSTS.radioEcho;
    total += formData.irmCt * COSTS.irmCt;
    if (formData.hasTherapie === 'oui') total += formData.therapieSeances * COSTS.seanceTherapie;
    if (formData.hasEvenementCouteux === 'oui') total += formData.evenementMontant;
    return total;
  };

  const getModelFromConstraints = (constraints) => {
    if (!constraints || constraints.length === 0) return null;
    if (constraints.includes('none')) return 'standard';
    if (constraints.includes('hmo')) return 'hmo';
    if (constraints.includes('family')) return 'familyDoctor';
    if (constraints.includes('telmed')) return 'telmed';
    return 'standard';
  };

  useEffect(() => {
    if (formData.acceptedConstraints?.length > 0) {
      const model = getModelFromConstraints(formData.acceptedConstraints);
      setFormData(prev => ({ ...prev, selectedModel: model }));
    }
  }, [formData.acceptedConstraints]);

  const getAvailableRegions = () => {
    try {
      const cantonData = insuranceData.cantons[formData.canton];
      if (!cantonData) return ['0'];
      return Object.keys(cantonData.regions);
    } catch { return ['0']; }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const base64 = evt.target.result.split(',')[1];
          const mediaType = file.type || 'application/pdf';
          const result = await analyzeLAMalPolicy(base64, mediaType);

          setExtractedPolicy(result);

          // Pre-fill form with extracted data
          const birthDate = result.assure?.date_naissance || '';
          const canton = result.assure?.canton || result.region_tarifaire || 'GE';

          setFormData(prev => ({
            ...prev,
            birthDate,
            canton,
            region: '0',
            currentInsurer: result.assureur || '',
            currentProduct: result.produit || '',
            currentPremium: result.prime_mensuelle || 0,
            currentFranchise: result.franchise || 300,
            currentModel: result.modele || 'standard',
            hasAccident: result.accident_inclus !== false,
          }));

          setStep(2);
        } catch (err) {
          setAnalysisError(err.message);
        }
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setAnalysisError(err.message);
      setIsAnalyzing(false);
    }
  };

  // Find best offers
  const findBestOffers = useMemo(() => {
    if (!formData.selectedFranchise || !formData.selectedModel || formData.withAccident === null) return [];

    const priceKey = formData.withAccident ? 'withAccident' : 'withoutAccident';
    const franchiseStr = String(formData.selectedFranchise);

    try {
      const cantonData = insuranceData.cantons[formData.canton];
      if (!cantonData) return [];
      const regionData = cantonData.regions[formData.region];
      if (!regionData) return [];
      const ageData = regionData.ageClasses[ageClass];
      if (!ageData) return [];
      const modelData = ageData.models[formData.selectedModel];
      if (!modelData) return [];

      return modelData.insurers
        .map(ins => {
          const price = ins.premiums[priceKey]?.[franchiseStr];
          if (!price) return null;
          return { name: ins.name, product: ins.product, monthlyPrice: price, yearlyPrice: price * 12, franchise: formData.selectedFranchise };
        })
        .filter(Boolean)
        .sort((a, b) => a.monthlyPrice - b.monthlyPrice)
        .slice(0, 5);
    } catch { return []; }
  }, [formData.selectedFranchise, formData.selectedModel, formData.withAccident, formData.canton, formData.region, ageClass]);

  const bestOffer = findBestOffers[0];
  const annualSavings = bestOffer ? (formData.currentPremium * 12) - bestOffer.yearlyPrice : 0;

  const handleNext = () => {
    if (step === 3) {
      const costs = calculateEstimatedCosts();
      setFormData(prev => ({ ...prev, estimatedCosts: costs, recommendedFranchise: costs >= 1800 ? 300 : 2500 }));
    }
    if (step === 5 && ageClass === 'child') {
      setFormData(prev => ({ ...prev, withAccident: true }));
    }
    setStep(step + 1);
  };

  const canProceed = () => {
    switch (step) {
      case 2: return formData.birthDate && formData.canton;
      case 3: return formData.selectedFranchise !== null;
      case 4: return formData.acceptedConstraints?.length > 0;
      case 5: return formData.withAccident !== null;
      default: return true;
    }
  };

  const modelLabels = { standard: 'Standard', telmed: 'Télémédecine', familyDoctor: 'Médecin de famille', hmo: 'HMO', medecin_famille: 'Médecin de famille' };
  const regions = getAvailableRegions();
  const estimatedCosts = calculateEstimatedCosts();

  return (
    <div className="sante-wizard">
      {/* Progress */}
      <div className="progress-nav">
        {[
          { num: 1, label: 'Upload' },
          { num: 2, label: 'Infos' },
          { num: 3, label: 'Franchise' },
          { num: 4, label: 'Modèle' },
          { num: 5, label: 'Accident' },
          { num: 6, label: 'Résultats' }
        ].map(s => (
          <button key={s.num} onClick={() => s.num < step && setStep(s.num)} className={`progress-step ${s.num === step ? 'active' : ''} ${s.num < step ? 'completed' : ''}`} disabled={s.num > step}>
            <div className="step-circle">{s.num < step ? <Check size={12} /> : s.num}</div>
            <span className="step-label">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="wizard-card">

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="step-content">
            <h2><Upload size={20} /> Upload de ta police LAMal</h2>
            <p className="step-intro">Importe ton certificat d'assurance pour analyser ta situation actuelle.</p>

            <label className="upload-zone">
              <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} hidden />
              {isAnalyzing ? (
                <div className="upload-loading">
                  <div className="spinner"></div>
                  <span>Analyse en cours...</span>
                </div>
              ) : (
                <>
                  <FileText size={40} />
                  <span>Clique ou glisse ton fichier ici</span>
                  <span className="upload-hint">PDF ou image</span>
                </>
              )}
            </label>

            {analysisError && (
              <div className="result-box error">
                <AlertCircle size={16} />
                <span>{analysisError}</span>
              </div>
            )}

            <button onClick={() => setStep(2)} className="btn btn-secondary btn-full" style={{ marginTop: '16px' }}>
              Entrer manuellement →
            </button>
          </div>
        )}

        {/* Step 2: Confirmation */}
        {step === 2 && (
          <div className="step-content">
            <h2>2. Confirme tes informations</h2>
            {extractedPolicy && (
              <div className="result-box success" style={{ marginBottom: '16px' }}>
                <Check size={16} />
                <span>Informations extraites de ta police</span>
              </div>
            )}

            <div className="form-group">
              <label>Date de naissance</label>
              <input type="date" className="form-input" value={formData.birthDate} onChange={e => setFormData({ ...formData, birthDate: e.target.value })} max="2026-01-01" />
              {formData.birthDate && <span className="form-hint">→ {ageClassLabels[ageClass]}</span>}
            </div>

            <div className="form-group">
              <label>Canton</label>
              <select className="form-input" value={formData.canton} onChange={e => setFormData({ ...formData, canton: e.target.value, region: '0' })}>
                {CANTONS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>

            {regions.length > 1 && (
              <div className="form-group">
                <label>Région tarifaire</label>
                <select className="form-input" value={formData.region} onChange={e => setFormData({ ...formData, region: e.target.value })}>
                  {regions.map(r => <option key={r} value={r}>Région {parseInt(r) + 1}</option>)}
                </select>
              </div>
            )}

            <div className="current-policy-section">
              <h3>Ta police actuelle</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Assureur</label>
                  <input type="text" className="form-input" value={formData.currentInsurer} onChange={e => setFormData({ ...formData, currentInsurer: e.target.value })} placeholder="Ex: CSS" />
                </div>
                <div className="form-group">
                  <label>Prime mensuelle (CHF)</label>
                  <input type="number" className="form-input" value={formData.currentPremium} onChange={e => setFormData({ ...formData, currentPremium: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Franchise actuelle</label>
                  <select className="form-input" value={formData.currentFranchise} onChange={e => setFormData({ ...formData, currentFranchise: parseInt(e.target.value) })}>
                    {(ageClass === 'child' ? [0, 100, 200, 300, 400, 500, 600] : [300, 500, 1000, 1500, 2000, 2500]).map(f => (
                      <option key={f} value={f}>CHF {f}.-</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Modèle actuel</label>
                  <select className="form-input" value={formData.currentModel} onChange={e => setFormData({ ...formData, currentModel: e.target.value })}>
                    <option value="standard">Standard</option>
                    <option value="telmed">Télémédecine</option>
                    <option value="medecin_famille">Médecin de famille</option>
                    <option value="hmo">HMO</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Franchise Questionnaire */}
        {step === 3 && (
          <div className="step-content">
            <h2>3. Frais médicaux estimés <Tooltip text="Pour déterminer ta franchise optimale" /></h2>

            <div className="question-section">
              <h3>Consultations</h3>
              <div className="stepper-group">
                <NumberStepper label="Médecin généraliste" value={formData.consultationsGeneraliste} onChange={v => setFormData({ ...formData, consultationsGeneraliste: v })} max={50} />
                <NumberStepper label="Spécialistes" value={formData.consultationsSpecialiste} onChange={v => setFormData({ ...formData, consultationsSpecialiste: v })} max={50} />
                <NumberStepper label="Urgences" value={formData.urgences} onChange={v => setFormData({ ...formData, urgences: v })} max={20} />
              </div>
            </div>

            <div className="question-section">
              <h3>Médicaments réguliers</h3>
              <div className="toggle-group">
                <ToggleButton selected={formData.hasMedicaments === 'oui'} onClick={() => setFormData({ ...formData, hasMedicaments: 'oui' })}>Oui</ToggleButton>
                <ToggleButton selected={formData.hasMedicaments === 'non'} onClick={() => setFormData({ ...formData, hasMedicaments: 'non', medicamentsCost: 0 })}>Non</ToggleButton>
              </div>
              {formData.hasMedicaments === 'oui' && (
                <div className="slider-group">
                  <div className="slider-header"><span>Coût mensuel</span><span className="slider-value">{formData.medicamentsCost} CHF</span></div>
                  <input type="range" min="10" max="200" step="10" value={formData.medicamentsCost} onChange={e => setFormData({ ...formData, medicamentsCost: parseInt(e.target.value) })} className="slider" />
                </div>
              )}
            </div>

            <div className="question-section">
              <h3>Examens & imagerie</h3>
              <div className="stepper-group">
                <NumberStepper label="Analyses labo" value={formData.analysesLabo} onChange={v => setFormData({ ...formData, analysesLabo: v })} max={30} />
                <NumberStepper label="Radio / écho" value={formData.radioEcho} onChange={v => setFormData({ ...formData, radioEcho: v })} max={20} />
                <NumberStepper label="IRM / CT" value={formData.irmCt} onChange={v => setFormData({ ...formData, irmCt: v })} max={10} />
              </div>
            </div>

            <div className="question-section">
              <h3>Thérapies</h3>
              <div className="toggle-group">
                <ToggleButton selected={formData.hasTherapie === 'oui'} onClick={() => setFormData({ ...formData, hasTherapie: 'oui' })}>Oui</ToggleButton>
                <ToggleButton selected={formData.hasTherapie === 'non'} onClick={() => setFormData({ ...formData, hasTherapie: 'non', therapieSeances: 0 })}>Non</ToggleButton>
              </div>
              {formData.hasTherapie === 'oui' && (
                <>
                  <div className="chip-group">{THERAPY_OPTIONS.map(t => <Chip key={t} selected={formData.therapieTypes.includes(t)} onClick={() => setFormData({ ...formData, therapieTypes: formData.therapieTypes.includes(t) ? formData.therapieTypes.filter(x => x !== t) : [...formData.therapieTypes, t] })}>{t}</Chip>)}</div>
                  <div className="stepper-group"><NumberStepper label="Séances/an" value={formData.therapieSeances} onChange={v => setFormData({ ...formData, therapieSeances: v })} max={200} /></div>
                </>
              )}
            </div>

            <div className="results-section">
              <div className="cost-result"><span>Frais estimés :</span><span className="cost-value">CHF {estimatedCosts.toLocaleString('fr-CH')}.-</span></div>
              <div className="recommendation-box"><strong>Recommandation :</strong> Franchise CHF {estimatedCosts >= 1800 ? '300' : '2\'500'}.-</div>

              {estimatedCosts < 1800 && (
                <div className="financial-capacity">
                  <p>Capacité financière en cas d'imprévu ?</p>
                  <div className="franchise-grid">
                    {[{ label: "3'200+", f: 2500 }, { label: "2'700", f: 2000 }, { label: "2'200", f: 1500 }, { label: "1'700", f: 1000 }, { label: "1'200", f: 500 }, { label: "1'000", f: 300 }].map(opt => (
                      <button key={opt.f} onClick={() => setFormData({ ...formData, selectedFranchise: opt.f })} className={`franchise-btn ${formData.selectedFranchise === opt.f ? 'selected' : ''}`}>
                        <span className="franchise-label">{opt.label}</span>
                        <span className="franchise-value">Fr. {opt.f}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {estimatedCosts >= 1800 && !formData.selectedFranchise && (
                <button onClick={() => setFormData({ ...formData, selectedFranchise: 300 })} className="btn btn-primary btn-full">Confirmer CHF 300.-</button>
              )}

              {formData.selectedFranchise && <div className="result-box success"><Check size={16} /><span>Franchise CHF {formData.selectedFranchise}.- sélectionnée</span></div>}
            </div>
          </div>
        )}

        {/* Step 4: Model */}
        {step === 4 && (
          <div className="step-content">
            <h2>4. Modèle d'assurance</h2>
            <p className="step-intro">Quelles contraintes acceptes-tu ?</p>
            <p className="step-hint">Coche toutes les options qui te conviennent</p>

            <div className="constraint-list">
              {[
                { id: 'telmed', emoji: '📞', label: 'Appeler une hotline avant de consulter', desc: 'Télémédecine 24h/24', reduction: '10-15%' },
                { id: 'family', emoji: '👨‍⚕️', label: 'Passer par un médecin de famille', desc: 'Médecin référent', reduction: '10-15%' },
                { id: 'hmo', emoji: '🏥', label: 'Consulter dans un centre HMO', desc: 'Réseau coordonné', reduction: '15-25%' },
                { id: 'none', emoji: '🔓', label: 'Aucune contrainte', desc: 'Libre choix total', reduction: '0%' }
              ].map(opt => {
                const isSelected = formData.acceptedConstraints?.includes(opt.id);
                const isNoneSelected = formData.acceptedConstraints?.includes('none');
                const isDisabled = opt.id !== 'none' && isNoneSelected;

                return (
                  <button key={opt.id} onClick={() => {
                    let c = formData.acceptedConstraints || [];
                    if (opt.id === 'none') c = isSelected ? [] : ['none'];
                    else { c = c.filter(x => x !== 'none'); c = isSelected ? c.filter(x => x !== opt.id) : [...c, opt.id]; }
                    setFormData({ ...formData, acceptedConstraints: c });
                  }} disabled={isDisabled} className={`constraint-btn ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}>
                    <div className="constraint-checkbox">{isSelected && <Check size={12} />}</div>
                    <div className="constraint-content"><span className="constraint-label">{opt.emoji} {opt.label}</span><span className="constraint-desc">{opt.desc}</span></div>
                    <span className={`constraint-reduction ${opt.id === 'none' ? 'neutral' : ''}`}>{opt.id === 'none' ? '—' : `−${opt.reduction}`}</span>
                  </button>
                );
              })}
            </div>

            {formData.acceptedConstraints?.length > 0 && (
              <div className="result-box success" style={{ marginTop: '16px' }}>
                <Check size={16} />
                <span>Modèle : <strong>{formData.acceptedConstraints.includes('none') ? 'Standard' : formData.acceptedConstraints.includes('hmo') ? 'HMO' : formData.acceptedConstraints.includes('family') ? 'Médecin de famille' : 'Télémédecine'}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Accident */}
        {step === 5 && (
          <div className="step-content">
            <h2>5. Couverture accident <Tooltip text="Si tu travailles +8h/semaine, ton employeur te couvre via la LAA" /></h2>
            {ageClass === 'child' ? (
              <div className="result-box success"><Check size={16} /><span>Incluse automatiquement pour les enfants</span></div>
            ) : (
              <div className="accident-options">
                <button onClick={() => setFormData({ ...formData, worksOver8h: true, withAccident: false })} className={`accident-btn ${formData.worksOver8h === true ? 'selected' : ''}`}>
                  <span className="accident-emoji">💼</span><span className="accident-title">Oui, +8h/sem</span><span className="accident-desc">Sans accident</span>
                </button>
                <button onClick={() => setFormData({ ...formData, worksOver8h: false, withAccident: true })} className={`accident-btn ${formData.worksOver8h === false ? 'selected' : ''}`}>
                  <span className="accident-emoji">🏠</span><span className="accident-title">Non, -8h/sem</span><span className="accident-desc">Avec accident</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 6: Comparison Results */}
        {step === 6 && (() => {
          // Calculate quote-part: 10% of costs above franchise, max 700 CHF
          const calculateQuotePart = (franchise, estimatedCosts) => {
            const costsAboveFranchise = Math.max(0, estimatedCosts - franchise);
            return Math.min(costsAboveFranchise * 0.1, 700);
          };

          // Current situation costs
          const currentQuotePart = calculateQuotePart(formData.currentFranchise, formData.estimatedCosts);
          const currentFranchisePaid = Math.min(formData.estimatedCosts, formData.currentFranchise);
          const currentTotalAnnual = (formData.currentPremium * 12) + currentFranchisePaid + currentQuotePart;

          // Best offer costs
          const newQuotePart = bestOffer ? calculateQuotePart(formData.selectedFranchise, formData.estimatedCosts) : 0;
          const newFranchisePaid = bestOffer ? Math.min(formData.estimatedCosts, formData.selectedFranchise) : 0;
          const newTotalAnnual = bestOffer ? (bestOffer.yearlyPrice + newFranchisePaid + newQuotePart) : 0;

          // Total savings
          const totalSavings = currentTotalAnnual - newTotalAnnual;

          return (
            <div className="step-content">
              <h2>🎯 Comparaison & économies</h2>

              {/* Current vs Best */}
              {formData.currentPremium > 0 && bestOffer && (
                <div className="comparison-cards">
                  <div className="comparison-card current">
                    <div className="comparison-label">Ta police actuelle</div>
                    <div className="comparison-insurer">{formData.currentInsurer || 'Non renseigné'}</div>
                    <div className="comparison-price">{formData.currentPremium.toFixed(0)} CHF<span>/mois</span></div>
                    <div className="comparison-detail">Franchise {formData.currentFranchise} • {modelLabels[formData.currentModel]}</div>
                  </div>
                  <div className="comparison-arrow"><ArrowRight size={24} /></div>
                  <div className="comparison-card best">
                    <div className="comparison-label">Meilleure offre</div>
                    <div className="comparison-insurer">{bestOffer.name}</div>
                    <div className="comparison-price">{bestOffer.monthlyPrice.toFixed(0)} CHF<span>/mois</span></div>
                    <div className="comparison-detail">Franchise {formData.selectedFranchise} • {modelLabels[formData.selectedModel]}</div>
                  </div>
                </div>
              )}

              {/* Global Annual Calculation */}
              {formData.currentPremium > 0 && bestOffer && (
                <div className="annual-breakdown">
                  <h3>💰 Coût annuel total</h3>
                  <p className="breakdown-subtitle">Basé sur tes frais médicaux estimés de <strong>{formData.estimatedCosts.toLocaleString('fr-CH')} CHF</strong></p>

                  <div className="breakdown-grid">
                    <div className="breakdown-column current">
                      <div className="breakdown-title">Situation actuelle</div>
                      <div className="breakdown-row"><span>Primes (12 mois)</span><span>{(formData.currentPremium * 12).toLocaleString('fr-CH')} CHF</span></div>
                      <div className="breakdown-row"><span>Franchise payée</span><span>{currentFranchisePaid.toLocaleString('fr-CH')} CHF</span></div>
                      <div className="breakdown-row"><span>Quote-part (10%)</span><span>{currentQuotePart.toFixed(0)} CHF</span></div>
                      <div className="breakdown-total"><span>Total annuel</span><span>{currentTotalAnnual.toLocaleString('fr-CH')} CHF</span></div>
                    </div>

                    <div className="breakdown-column best">
                      <div className="breakdown-title">Avec {bestOffer.name}</div>
                      <div className="breakdown-row"><span>Primes (12 mois)</span><span>{bestOffer.yearlyPrice.toLocaleString('fr-CH')} CHF</span></div>
                      <div className="breakdown-row"><span>Franchise payée</span><span>{newFranchisePaid.toLocaleString('fr-CH')} CHF</span></div>
                      <div className="breakdown-row"><span>Quote-part (10%)</span><span>{newQuotePart.toFixed(0)} CHF</span></div>
                      <div className="breakdown-total"><span>Total annuel</span><span>{newTotalAnnual.toLocaleString('fr-CH')} CHF</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Savings */}
              {totalSavings > 0 && (
                <div className="savings-box">
                  <TrendingDown size={24} />
                  <div className="savings-content">
                    <span className="savings-label">Économie totale par an</span>
                    <span className="savings-amount">{totalSavings.toFixed(0)} CHF</span>
                  </div>
                </div>
              )}

              {totalSavings <= 0 && formData.currentPremium > 0 && (
                <div className="result-box success">
                  <Check size={16} />
                  <span>Bravo ! Tu as déjà un bon contrat 🎉</span>
                </div>
              )}

              {/* Top offers */}
              <h3 style={{ marginTop: '20px' }}>Top 5 offres</h3>
              <div className="offers-list">
                {findBestOffers.map((offer, i) => {
                  const offerQuotePart = calculateQuotePart(offer.franchise, formData.estimatedCosts);
                  const offerFranchisePaid = Math.min(formData.estimatedCosts, offer.franchise);
                  const offerTotal = offer.yearlyPrice + offerFranchisePaid + offerQuotePart;
                  return (
                    <div key={i} className={`offer-card ${i === 0 ? 'best' : ''}`}>
                      {i === 0 && <span className="offer-badge">MEILLEURE</span>}
                      <div className="offer-header">
                        <div className="offer-rank">#{i + 1}</div>
                        <div className="offer-info"><span className="offer-name">{offer.name}</span>{offer.product && <span className="offer-product">{offer.product}</span>}</div>
                        <div className="offer-price"><span className="offer-monthly">{offer.monthlyPrice.toFixed(0)} CHF</span><span className="offer-period">/mois</span></div>
                      </div>
                      <div className="offer-details">
                        <span>Primes: {offer.yearlyPrice.toLocaleString('fr-CH')} CHF/an</span>
                        <span>Total max: {offerTotal.toLocaleString('fr-CH')} CHF/an</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button onClick={() => { setStep(1); setExtractedPolicy(null); setFormData({ birthDate: '', canton: 'GE', region: '0', currentInsurer: '', currentProduct: '', currentPremium: 0, currentFranchise: 300, currentModel: 'standard', hasAccident: true, consultationsGeneraliste: 0, consultationsSpecialiste: 0, urgences: 0, hasMedicaments: null, medicamentsCost: 50, analysesLabo: 0, radioEcho: 0, irmCt: 0, hasTherapie: null, therapieTypes: [], therapieSeances: 0, hasEvenementCouteux: null, evenementTypes: [], evenementMontant: 0, estimatedCosts: 0, recommendedFranchise: null, financialCapacity: null, selectedFranchise: null, acceptedConstraints: [], selectedModel: null, worksOver8h: null, withAccident: null }); }} className="btn btn-secondary btn-full">Recommencer</button>
              <p className="data-source">Source: OFSP 2026</p>
            </div>
          );
        })()}

        {/* Navigation */}
        {step > 1 && step < 6 && (
          <div className="wizard-actions">
            <button onClick={() => setStep(step - 1)} className="btn btn-secondary"><ChevronLeft size={18} /> Retour</button>
            <button onClick={handleNext} disabled={!canProceed()} className="btn btn-primary">{step === 5 ? 'Voir les résultats' : 'Continuer'}</button>
          </div>
        )}
      </div>

      <style>{`
        .sante-wizard { padding: 0; max-width: 600px; margin: 0 auto; }
        .progress-nav { display: flex; justify-content: center; gap: 4px; margin-bottom: 20px; flex-wrap: wrap; padding: 0 16px; }
        .progress-step { display: flex; flex-direction: column; align-items: center; gap: 4px; background: transparent; border: none; cursor: pointer; opacity: 0.4; transition: all 0.2s; padding: 4px; }
        .progress-step.active, .progress-step.completed { opacity: 1; }
        .progress-step:disabled { cursor: default; }
        .step-circle { width: 28px; height: 28px; border-radius: 50%; background: #F6F4EF; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #999; }
        .progress-step.active .step-circle { background: #FD6F61; color: white; }
        .progress-step.completed .step-circle { background: #99C7AE; color: white; }
        .step-label { font-size: 10px; color: #999; }
        .progress-step.active .step-label { color: #FD6F61; font-weight: 600; }
        .progress-step.completed .step-label { color: #99C7AE; }
        
        .wizard-card { background: white; border-radius: 20px; padding: 24px; box-shadow: 0 2px 16px rgba(0,0,0,0.06); margin: 0 16px; }
        .step-content h2 { font-size: 18px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; color: #333; }
        .step-intro { font-size: 14px; margin-bottom: 8px; color: #666; }
        .step-hint { font-size: 12px; color: #999; margin-bottom: 14px; }
        
        .upload-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 48px 24px; background: linear-gradient(135deg, #D4EDDA 0%, #C2E3C9 100%); border: 2px dashed #99C7AE; border-radius: 16px; cursor: pointer; color: #333; transition: all 0.2s; }
        .upload-zone:hover { border-color: #7AB092; background: linear-gradient(135deg, #C2E3C9 0%, #B0DAB8 100%); transform: translateY(-2px); }
        .upload-zone svg { color: #6B9E7D; }
        .upload-hint { font-size: 12px; color: #6B9E7D; }
        .upload-loading { display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .spinner { width: 36px; height: 36px; border: 3px solid #D4EDDA; border-top-color: #99C7AE; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
        .form-input { width: 100%; padding: 12px 14px; background: #F6F4EF; border: 1px solid #E5E5E5; border-radius: 12px; color: #333; font-size: 15px; font-family: inherit; }
        .form-input:focus { outline: none; border-color: #99C7AE; background: white; }
        .form-hint { font-size: 12px; color: #99C7AE; margin-top: 6px; display: block; font-weight: 500; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        
        .current-policy-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid #E5E5E5; }
        .current-policy-section h3 { font-size: 14px; font-weight: 600; margin-bottom: 14px; color: #FD6F61; display: flex; align-items: center; gap: 6px; }
        
        .result-box { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; font-size: 13px; }
        .result-box.success { background: #D4EDDA; color: #2D5F3E; }
        .result-box.error { background: #FDDDD8; color: #C53030; }
        
        .question-section { margin-bottom: 18px; }
        .question-section h3 { font-size: 12px; font-weight: 700; color: #FD6F61; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
        
        .stepper-group { background: #F6F4EF; border-radius: 12px; padding: 8px 14px; }
        .number-stepper { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .number-stepper:last-child { border-bottom: none; }
        .stepper-label { font-size: 14px; color: #333; }
        .stepper-controls { display: flex; align-items: center; gap: 10px; }
        .stepper-btn { width: 32px; height: 32px; border-radius: 8px; border: none; background: linear-gradient(135deg, #99C7AE 0%, #7AB092 100%); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 600; transition: all 0.2s; }
        .stepper-btn:hover { transform: scale(1.05); }
        .stepper-btn:disabled { background: #E5E5E5; color: #999; cursor: not-allowed; transform: none; }
        .stepper-value { width: 36px; text-align: center; font-weight: 700; font-size: 16px; color: #333; }
        
        .toggle-group { display: flex; gap: 10px; margin-bottom: 10px; }
        .toggle-btn { padding: 10px 18px; background: white; border: 2px solid #E5E5E5; border-radius: 10px; color: #666; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; }
        .toggle-btn:hover { border-color: #99C7AE; }
        .toggle-btn.selected { background: linear-gradient(135deg, #99C7AE 0%, #7AB092 100%); border-color: #99C7AE; color: white; font-weight: 600; }
        
        .chip-group { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
        .chip { padding: 6px 14px; background: white; border: 1px solid #E5E5E5; border-radius: 20px; color: #666; cursor: pointer; font-size: 12px; transition: all 0.2s; }
        .chip:hover { border-color: #99C7AE; }
        .chip.selected { background: #99C7AE; border-color: #99C7AE; color: white; font-weight: 600; }
        
        .slider-group { background: #F6F4EF; border-radius: 12px; padding: 14px; }
        .slider-header { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
        .slider-value { color: #FD6F61; font-weight: 700; }
        .slider { width: 100%; -webkit-appearance: none; background: transparent; height: 24px; }
        .slider::-webkit-slider-track { height: 8px; background: #E5E5E5; border-radius: 4px; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; background: linear-gradient(135deg, #FD6F61 0%, #E55A4E 100%); border-radius: 50%; cursor: pointer; margin-top: -7px; box-shadow: 0 2px 8px rgba(253,111,97,0.4); }
        
        .results-section { background: linear-gradient(135deg, #F6F4EF 0%, #EBE9E3 100%); border-radius: 16px; padding: 18px; }
        .cost-result { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .cost-value { font-size: 20px; font-weight: 700; color: #333; }
        .recommendation-box { padding: 12px 14px; background: #D4EDDA; border-radius: 12px; font-size: 13px; color: #2D5F3E; margin-bottom: 14px; font-weight: 500; }
        
        .financial-capacity { margin-bottom: 12px; }
        .financial-capacity p { font-size: 14px; color: #666; margin-bottom: 12px; }
        .franchise-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .franchise-btn { padding: 14px 6px; background: white; border: 2px solid #E5E5E5; border-radius: 12px; color: #333; cursor: pointer; text-align: center; transition: all 0.2s; }
        .franchise-btn:hover { border-color: #99C7AE; }
        .franchise-btn.selected { background: linear-gradient(135deg, #FD6F61 0%, #E55A4E 100%); border-color: #FD6F61; color: white; }
        .franchise-label { display: block; font-weight: 700; font-size: 14px; }
        .franchise-value { display: block; font-size: 11px; opacity: 0.7; margin-top: 2px; }
        
        .constraint-list { display: flex; flex-direction: column; gap: 10px; }
        .constraint-btn { display: flex; align-items: center; gap: 12px; padding: 14px; background: white; border: 2px solid #E5E5E5; border-radius: 14px; cursor: pointer; text-align: left; width: 100%; transition: all 0.2s; }
        .constraint-btn:hover { border-color: #99C7AE; }
        .constraint-btn.selected { background: #D4EDDA; border-color: #99C7AE; }
        .constraint-btn.disabled { opacity: 0.5; cursor: not-allowed; }
        .constraint-checkbox { width: 20px; height: 20px; border: 2px solid #E5E5E5; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .constraint-btn.selected .constraint-checkbox { background: #99C7AE; border-color: #99C7AE; color: white; }
        .constraint-content { flex: 1; }
        .constraint-label { display: block; font-size: 14px; font-weight: 600; color: #333; }
        .constraint-desc { display: block; font-size: 12px; color: #999; margin-top: 2px; }
        .constraint-reduction { padding: 4px 10px; background: #D4EDDA; color: #2D5F3E; border-radius: 8px; font-size: 12px; font-weight: 700; }
        .constraint-reduction.neutral { background: #F6F4EF; color: #999; }
        
        .accident-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .accident-btn { padding: 24px 16px; background: white; border: 2px solid #E5E5E5; border-radius: 16px; cursor: pointer; text-align: center; transition: all 0.2s; }
        .accident-btn:hover { border-color: #99C7AE; transform: translateY(-2px); }
        .accident-btn.selected { background: linear-gradient(135deg, #99C7AE 0%, #7AB092 100%); border-color: #99C7AE; color: white; }
        .accident-emoji { display: block; font-size: 28px; margin-bottom: 10px; }
        .accident-title { display: block; font-weight: 700; font-size: 14px; }
        .accident-desc { display: block; font-size: 12px; opacity: 0.7; margin-top: 4px; }
        
        .comparison-cards { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .comparison-card { flex: 1; padding: 16px 12px; border-radius: 14px; text-align: center; }
        .comparison-card.current { background: #F6F4EF; border: 1px solid #E5E5E5; }
        .comparison-card.best { background: #D4EDDA; border: 2px solid #99C7AE; }
        .comparison-arrow { color: #999; flex-shrink: 0; }
        .comparison-label { font-size: 10px; color: #999; text-transform: uppercase; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px; }
        .comparison-insurer { font-weight: 700; font-size: 15px; margin-bottom: 6px; color: #333; }
        .comparison-price { font-size: 22px; font-weight: 800; color: #333; }
        .comparison-price span { font-size: 12px; font-weight: 400; }
        .comparison-card.best .comparison-price { color: #2D5F3E; }
        .comparison-detail { font-size: 11px; color: #999; margin-top: 6px; }
        
        .annual-breakdown { background: #F6F4EF; border-radius: 16px; padding: 18px; margin-bottom: 16px; }
        .annual-breakdown h3 { font-size: 16px; font-weight: 700; margin-bottom: 6px; color: #333; }
        .breakdown-subtitle { font-size: 13px; color: #666; margin-bottom: 14px; }
        .breakdown-subtitle strong { color: #FD6F61; }
        .breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .breakdown-column { background: white; border-radius: 12px; padding: 14px; }
        .breakdown-column.current { border: 1px solid #E5E5E5; }
        .breakdown-column.best { border: 2px solid #99C7AE; background: #D4EDDA; }
        .breakdown-title { font-size: 12px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
        .breakdown-column.best .breakdown-title { color: #2D5F3E; }
        .breakdown-row { display: flex; justify-content: space-between; font-size: 12px; color: #666; padding: 4px 0; }
        .breakdown-total { display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; color: #333; padding-top: 10px; margin-top: 8px; border-top: 1px solid #E5E5E5; }
        .breakdown-column.best .breakdown-total { color: #2D5F3E; border-top-color: #99C7AE; }
        
        .savings-box { display: flex; align-items: center; gap: 14px; padding: 18px; background: linear-gradient(135deg, #FD6F61 0%, #E55A4E 100%); border-radius: 16px; margin-bottom: 18px; color: white; }
        .savings-box svg { color: white; }
        .savings-content { flex: 1; }
        .savings-label { display: block; font-size: 12px; opacity: 0.9; }
        .savings-amount { display: block; font-size: 26px; font-weight: 800; }
        
        .offers-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
        .offer-card { padding: 14px; background: white; border: 1px solid #E5E5E5; border-radius: 14px; position: relative; }
        .offer-card.best { background: #D4EDDA; border: 2px solid #99C7AE; }
        .offer-badge { position: absolute; top: -8px; left: 12px; background: linear-gradient(135deg, #FD6F61 0%, #E55A4E 100%); color: white; font-size: 9px; padding: 3px 10px; border-radius: 6px; font-weight: 700; text-transform: uppercase; }
        .offer-header { display: flex; align-items: center; gap: 12px; }
        .offer-rank { font-size: 12px; color: #999; font-weight: 600; }
        .offer-info { flex: 1; }
        .offer-name { display: block; font-weight: 700; font-size: 16px; color: #333; }
        .offer-product { display: block; font-size: 11px; color: #999; margin-top: 2px; }
        .offer-price { text-align: right; }
        .offer-monthly { font-size: 18px; font-weight: 800; color: #FD6F61; }
        .offer-card.best .offer-monthly { color: #2D5F3E; }
        .offer-period { font-size: 11px; color: #999; }
        .offer-details { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #E5E5E5; font-size: 12px; color: #666; }
        
        .data-source { text-align: center; font-size: 11px; color: #999; margin-top: 16px; }
        
        .wizard-actions { display: flex; gap: 12px; margin-top: 20px; }
        .wizard-actions .btn { flex: 1; }
        .btn { padding: 14px 20px; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .btn-primary { background: linear-gradient(135deg, #FD6F61 0%, #E55A4E 100%); color: white; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:disabled { background: #E5E5E5; color: #999; cursor: not-allowed; transform: none; }
        .btn-secondary { background: #F6F4EF; color: #333; border: 1px solid #E5E5E5; }
        .btn-secondary:hover { background: #EBE9E3; }
        .btn-full { width: 100%; }
        
        .tooltip-wrapper { position: relative; display: inline-flex; align-items: center; margin-left: 6px; }
        .tooltip-trigger { display: inline-flex; align-items: center; color: #999; cursor: help; }
        .tooltip-content { position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%); background: #2F3858; border-radius: 10px; padding: 10px 12px; font-size: 12px; color: white; width: 200px; z-index: 100; box-shadow: 0 4px 16px rgba(0,0,0,0.2); font-weight: normal; }
      `}</style>
    </div>
  );
}

export default Sante;
