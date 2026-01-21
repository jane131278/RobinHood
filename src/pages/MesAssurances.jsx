import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Eye, X, Shield, Car, Home, Heart, Scale, Plane, PiggyBank } from 'lucide-react';
import { getPolicies, addPolicy, deletePolicy } from '../services/storage';
import { analyzePDF } from '../services/claude';

function MesAssurances() {
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        setPolicies(getPolicies());
    }, []);

    const handleFileUpload = async (files) => {
        if (!files || files.length === 0) return;

        setUploading(true);

        for (const file of files) {
            if (file.type !== 'application/pdf') {
                alert('Seuls les fichiers PDF sont acceptés');
                continue;
            }

            try {
                // Convert to base64
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64String = reader.result.split(',')[1];
                        resolve(base64String);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                // Analyze with Claude
                const policyData = await analyzePDF(base64, file.name);

                // Save to storage
                const newPolicy = addPolicy({
                    ...policyData,
                    file_name: file.name
                });

                setPolicies(prev => [...prev, newPolicy]);
            } catch (error) {
                console.error('Erreur upload:', error);
                alert(`Erreur lors de l'analyse de ${file.name}: ${error.message}`);
            }
        }

        setUploading(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFileUpload(e.dataTransfer.files);
    };

    const handleDelete = (id) => {
        if (confirm('Supprimer cette police ?')) {
            deletePolicy(id);
            setPolicies(prev => prev.filter(p => p.id !== id));
            setSelectedPolicy(null);
        }
    };

    const getTypeIcon = (type) => {
        const icons = {
            lamal: <Heart />,
            complementaire: <Heart />,
            rc_menage: <Shield />,
            auto: <Car />,
            menage: <Home />,
            vie: <PiggyBank />,
            '3a': <PiggyBank />,
            '3b': <PiggyBank />,
            juridique: <Scale />,
            voyage: <Plane />
        };
        return icons[type] || <FileText />;
    };

    const getScoreColor = (score) => {
        if (score >= 70) return 'var(--success)';
        if (score >= 40) return 'var(--warning)';
        return 'var(--error)';
    };

    const totalPremium = policies.reduce((sum, p) => sum + (p.prime_mensuelle || 0), 0);

    return (
        <div>
            <h1 className="page-title">📋 Mes Assurances</h1>
            <p className="page-subtitle">{policies.length} police{policies.length > 1 ? 's' : ''} • {totalPremium.toLocaleString('fr-CH')} CHF/mois</p>

            {/* Upload Zone */}
            <div
                className={`upload-zone ${dragOver ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files)}
                />
                {uploading ? (
                    <>
                        <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                        <div className="upload-text">Analyse en cours...</div>
                        <div className="upload-subtext">Claude analyse ta police d'assurance</div>
                    </>
                ) : (
                    <>
                        <div className="upload-icon">📄</div>
                        <div className="upload-text">Glisse tes polices ici</div>
                        <div className="upload-subtext">ou clique pour sélectionner des PDFs</div>
                    </>
                )}
            </div>

            {/* Policies List */}
            <div style={{ marginTop: '24px' }}>
                {policies.map(policy => (
                    <div
                        key={policy.id}
                        className="policy-card"
                        onClick={() => setSelectedPolicy(policy)}
                    >
                        <div className="policy-icon">
                            {getTypeIcon(policy.type)}
                        </div>
                        <div className="policy-info">
                            <div className="policy-name">{policy.assureur}</div>
                            <div className="policy-type">{policy.type?.replace('_', ' ').toUpperCase()}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div className="policy-premium">{policy.prime_mensuelle?.toLocaleString('fr-CH')} CHF</div>
                            <div style={{
                                fontSize: '12px',
                                color: getScoreColor(policy.score_qualite),
                                fontWeight: 600
                            }}>
                                Score: {policy.score_qualite}/100
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Policy Detail Modal */}
            {selectedPolicy && (
                <div className="modal-overlay" onClick={() => setSelectedPolicy(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 className="modal-title">{selectedPolicy.assureur}</h2>
                            <button onClick={() => setSelectedPolicy(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                            <div className={`gauge ${selectedPolicy.score_qualite >= 70 ? 'gauge-good' : selectedPolicy.score_qualite >= 40 ? 'gauge-medium' : 'gauge-bad'}`}>
                                {selectedPolicy.score_qualite}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600 }}>{selectedPolicy.type?.replace('_', ' ').toUpperCase()}</div>
                                <div style={{ color: 'var(--charcoal-light)' }}>{selectedPolicy.categorie}</div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Couverture</label>
                            <p>{selectedPolicy.couverture}</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Prime mensuelle</label>
                                <p style={{ fontWeight: 600, color: 'var(--sage-green)' }}>{selectedPolicy.prime_mensuelle?.toLocaleString('fr-CH')} CHF</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Franchise</label>
                                <p>{selectedPolicy.franchise?.toLocaleString('fr-CH')} CHF</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Échéance</label>
                                <p>{selectedPolicy.date_echeance ? new Date(selectedPolicy.date_echeance).toLocaleDateString('fr-CH') : '-'}</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Délai résiliation</label>
                                <p>{selectedPolicy.delai_resiliation || '-'}</p>
                            </div>
                        </div>

                        {selectedPolicy.resume && (
                            <div className="form-group">
                                <label className="form-label">Résumé</label>
                                <p>{selectedPolicy.resume}</p>
                            </div>
                        )}

                        {selectedPolicy.points_attention?.length > 0 && (
                            <div className="form-group">
                                <label className="form-label">Points d'attention</label>
                                <ul style={{ paddingLeft: '20px' }}>
                                    {selectedPolicy.points_attention.map((point, i) => (
                                        <li key={i}>{point}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button
                                className="btn btn-coral"
                                onClick={() => handleDelete(selectedPolicy.id)}
                                style={{ flex: 1 }}
                            >
                                <Trash2 size={18} /> Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MesAssurances;
