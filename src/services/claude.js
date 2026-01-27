// Claude API Service for JANE+
const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';

// Analyze PDF and extract policy information
export async function analyzePDF(base64Content, fileName) {
    const systemPrompt = `Tu es un expert en assurances suisses. Analyse ce document PDF de police d'assurance et extrais les informations suivantes au format JSON:
{
  "assureur": "nom de la compagnie d'assurance",
  "type": "type d'assurance (lamal, complementaire, rc_menage, auto, menage, vie, juridique, voyage, 3a, 3b, autre)",
  "categorie": "catégorie (maladie, responsabilite, auto, biens, prevoyance, protection, divers)",
  "couverture": "description de ce qui est couvert",
  "franchise": montant de la franchise en CHF (nombre),
  "prime_mensuelle": montant mensuel en CHF (nombre),
  "prime_annuelle": montant annuel en CHF (nombre),
  "date_debut": "date de début YYYY-MM-DD",
  "date_echeance": "date d'échéance YYYY-MM-DD",
  "delai_resiliation": "délai de résiliation (ex: 3 mois avant échéance)",
  "numero_police": "numéro de la police",
  "resume": "résumé en 2-3 phrases des points clés",
  "points_attention": ["liste des points à surveiller"],
  "score_qualite": score de 1 à 100 basé sur le rapport qualité/prix et la couverture
}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'document',
                            source: {
                                type: 'base64',
                                media_type: 'application/pdf',
                                data: base64Content
                            }
                        },
                        {
                            type: 'text',
                            text: `Analyse cette police d'assurance (${fileName}) et extrais les informations demandées.`
                        }
                    ]
                }],
                system: systemPrompt
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Erreur API Claude');
        }

        const data = await response.json();
        const textContent = data.content[0].text;

        // Parse JSON from response
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Format de réponse invalide');
    } catch (error) {
        console.error('Erreur analyse PDF:', error);
        throw error;
    }
}

// Chat with context about user's policies
export async function chatWithContext(message, policies) {
    const policiesSummary = policies.map(p => `
- ${p.assureur} (${p.type}): ${p.couverture}
  Prime: ${p.prime_mensuelle} CHF/mois, Franchise: ${p.franchise} CHF
  Échéance: ${p.date_echeance}, Score qualité: ${p.score_qualite}/100
`).join('\n');

    const systemPrompt = `Tu es un assistant bienveillant qui aide les gens à comprendre leurs assurances. Tu tutoies l'utilisateur.

Voici les polices d'assurance de l'utilisateur:
${policiesSummary || 'Aucune police enregistrée.'}

Règles:
- Réponds de façon claire et accessible
- Base-toi sur les informations des polices pour personnaliser tes réponses
- Tu peux donner des avis qualitatifs ("ta prime semble élevée") mais pas de conseils financiers personnalisés
- Mentionne les délais de résiliation suisses quand pertinent
- Ajoute un disclaimer si nécessaire: "Ceci n'est pas un conseil financier personnalisé"`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{ role: 'user', content: message }],
                system: systemPrompt
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Erreur API Claude');
        }

        const data = await response.json();
        return data.content[0].text;
    } catch (error) {
        console.error('Erreur chat:', error);
        throw error;
    }
}

// Detect issues in policies
// Analyze LAMal policy specifically for health insurance module
export async function analyzeLAMalPolicy(base64Content, mediaType = 'application/pdf') {
    const systemPrompt = `Tu es un expert en assurances maladie suisses (LAMal). Analyse ce certificat d'assurance maladie et extrais les informations suivantes au format JSON strict:

{
  "assure": {
    "nom": "nom de famille de l'assuré",
    "prenom": "prénom de l'assuré",
    "date_naissance": "date de naissance au format YYYY-MM-DD",
    "adresse": "adresse complète",
    "code_postal": "code postal (4 chiffres)",
    "localite": "ville/localité",
    "canton": "code canton à 2 lettres (GE, VD, ZH, etc.)"
  },
  "assureur": "nom de la compagnie (ex: Groupe Mutuel, CSS, Helsana...)",
  "produit": "nom du produit d'assurance (ex: OptiMed, Sana...)",
  "modele": "standard|medecin_famille|hmo|telmed",
  "modele_description": "description du modèle (ex: Médecin de premier recours: Dr X)",
  "medecin_reference": "nom du médecin de référence si applicable, sinon null",
  "franchise": montant de la franchise annuelle en CHF (nombre entier),
  "prime_mensuelle": montant de la prime mensuelle nette à payer en CHF (nombre),
  "prime_brute": montant brut avant déductions en CHF (nombre),
  "deductions": montant total des déductions mensuelles en CHF (nombre ou 0),
  "region_tarifaire": "code région (GE, VD, ZH, etc.)",
  "date_debut": "date de début au format YYYY-MM-DD",
  "date_fin": "date de fin au format YYYY-MM-DD",
  "numero_assure": "numéro de l'assuré",
  "avs": "numéro AVS si présent, sinon null",
  "paiement": "mensuel|trimestriel|semestriel|annuel",
  "couvertures": ["liste des couvertures incluses"],
  "accident_inclus": true ou false,
  "resume": "résumé en 1-2 phrases"
}

IMPORTANT: 
- Pour le modèle, utilise "medecin_famille" si c'est un modèle médecin de premier recours/médecin de famille
- La prime_mensuelle doit être le montant FINAL à payer (après déductions)
- Le canton doit être le code à 2 lettres (GE pour Genève, VD pour Vaud, etc.)
- Déduis le canton du code postal si non explicite (12xx = GE, 10xx = VD, 80xx = ZH, etc.)
- Réponds UNIQUEMENT avec le JSON valide, sans markdown, sans texte avant/après`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: mediaType === 'application/pdf' ? 'document' : 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data: base64Content
                            }
                        },
                        {
                            type: 'text',
                            text: 'Analyse ce certificat d\'assurance maladie LAMal suisse et extrais toutes les informations demandées.'
                        }
                    ]
                }],
                system: systemPrompt
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('API Error:', error);
            throw new Error(error.error?.message || 'Erreur API Claude');
        }

        const data = await response.json();
        const textContent = data.content[0].text;

        // Parse JSON from response
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Format de réponse invalide');
    } catch (error) {
        console.error('Erreur analyse LAMal:', error);
        throw error;
    }
}

export async function detectIssues(policies) {
    if (policies.length === 0) return [];

    const policiesSummary = JSON.stringify(policies, null, 2);

    const systemPrompt = `Tu es un expert en assurances suisses. Analyse le portefeuille d'assurances et détecte les problèmes potentiels.

Retourne un JSON avec ce format:
{
  "alertes": [
    {
      "type": "doublon|trou|sur_assurance|sous_assurance|prix_eleve|delai",
      "severite": "haute|moyenne|basse",
      "titre": "titre court",
      "description": "explication détaillée",
      "polices_concernees": ["ids des polices"]
    }
  ],
  "score_global": score de 1 à 100 du portefeuille,
  "recommendations": ["liste d'actions recommandées"]
}

Réponds UNIQUEMENT avec le JSON.`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: `Analyse ce portefeuille d'assurances et détecte les problèmes:\n\n${policiesSummary}`
                }],
                system: systemPrompt
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Erreur API Claude');
        }

        const data = await response.json();
        const textContent = data.content[0].text;

        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { alertes: [], score_global: 0, recommendations: [] };
    } catch (error) {
        console.error('Erreur détection:', error);
        return { alertes: [], score_global: 0, recommendations: [] };
    }
}
