/**
 * Script d'extraction des primes LAMal depuis le fichier Excel OFSP
 * Génère swiss-insurance-2026.json selon la structure définie
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Charger le mapping des assureurs
const insurerMapping = require('./insurer-mapping.json').insurers;

// Mapping des codes OFSP vers nos clés
const AGE_CLASS_MAP = {
    'AKL-KIN': 'child',      // Enfants (0-18)
    'AKL-JUG': 'youngAdult', // Jeunes adultes (19-25)
    'AKL-ERW': 'adult'       // Adultes (26+)
};

const ACCIDENT_MAP = {
    'MIT-UNF': 'withAccident',
    'OHN-UNF': 'withoutAccident'
};

// Mapping des types de tarif vers nos modèles
const MODEL_KEYWORDS = {
    // Standard (libre choix)
    'standard': ['Basisversicherung', 'Grundversicherung', 'Base', 'Standard'],
    // Télémédecine
    'telmed': ['Callmed', 'Telmed', 'Tel', '24', 'Call', 'Smart', 'Telemedizin', 'Arcosana'],
    // Médecin de famille
    'familyDoctor': ['Hausarzt', 'médecin de famille', 'Casa', 'PrimaCare', 'Caremed', 'Profit', 'Praxisversicherung'],
    // HMO
    'hmo': ['HMO', 'Managed Care', 'Sante', 'Réseau', 'Netzwerk', 'Sanacare', 'Medbase']
};

function detectModel(tarifName, tarifType) {
    const nameLower = tarifName.toLowerCase();

    // Vérifier chaque modèle
    for (const [model, keywords] of Object.entries(MODEL_KEYWORDS)) {
        for (const keyword of keywords) {
            if (nameLower.includes(keyword.toLowerCase())) {
                return model;
            }
        }
    }

    // Par défaut, si TAR-ORD ou pas de correspondance → standard
    if (tarifType === 'TAR-ORD') return 'standard';

    // Si c'est TAR-HAM (Hausarzt Modell) → familyDoctor
    if (tarifType === 'TAR-HAM') return 'familyDoctor';

    return 'standard';
}

function extractFranchise(franchiseCode) {
    // FRA-0, FRA-100, FRA-300, etc.
    const match = franchiseCode.match(/FRA-(\d+)/);
    return match ? match[1] : null;
}

function extractRegion(regionCode) {
    // PR-REG CH0, PR-REG CH1, PR-REG CH2
    const match = regionCode.match(/PR-REG CH(\d+)/);
    return match ? match[1] : '0';
}

function main() {
    const inputFile = path.join(__dirname, '..', 'gesamtbericht_ch (2).xlsx');
    const outputFile = path.join(__dirname, '..', 'src', 'data', 'swiss-insurance-2026.json');

    console.log('📂 Lecture du fichier Excel...');
    const workbook = XLSX.readFile(inputFile);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convertir en JSON
    const rows = XLSX.utils.sheet_to_json(sheet);
    console.log(`📊 ${rows.length} lignes trouvées`);

    // Structure de sortie
    const result = {
        _metadata: {
            description: "Primes LAMal Suisse 2026",
            source: "OFSP (Office fédéral de la santé publique)",
            year: 2026,
            lastUpdated: new Date().toISOString().split('T')[0],
            version: "1.0"
        },
        _schema: {
            ageClasses: {
                child: "Enfant (≤18 ans)",
                youngAdult: "Jeune adulte (19-25 ans)",
                adult: "Adulte (≥26 ans)"
            },
            models: {
                standard: "Assurance de base (libre choix)",
                telmed: "Télémédecine",
                familyDoctor: "Médecin de famille",
                hmo: "HMO / Réseau"
            },
            franchises: {
                child: [0, 100, 200, 300, 400, 500, 600],
                youngAdult: [300, 500, 1000, 1500, 2000, 2500],
                adult: [300, 500, 1000, 1500, 2000, 2500]
            }
        },
        cantons: {}
    };

    // Traiter chaque ligne
    let processed = 0;
    let skipped = 0;

    for (const row of rows) {
        const canton = row['Kanton'];
        const regionCode = row['Region'];
        const ageClassCode = row['Altersklasse'];
        const accidentCode = row['Unfalleinschluss'];
        const tarifType = row['Tariftyp'];
        const tarifName = row['Tarifbezeichnung'] || '';
        const franchiseCode = row['Franchise'];
        const premium = row['Prämie'];
        const insurerCode = row['Versicherer'];

        // Skip si données manquantes
        if (!canton || !premium || !franchiseCode || !insurerCode) {
            skipped++;
            continue;
        }

        const region = extractRegion(regionCode);
        const ageClass = AGE_CLASS_MAP[ageClassCode];
        const accidentType = ACCIDENT_MAP[accidentCode];
        const franchise = extractFranchise(franchiseCode);
        const model = detectModel(tarifName, tarifType);
        const insurerName = insurerMapping[insurerCode] || `Assureur ${insurerCode}`;

        if (!ageClass || !accidentType || !franchise) {
            skipped++;
            continue;
        }

        // Créer la structure si nécessaire
        if (!result.cantons[canton]) {
            result.cantons[canton] = {
                name: getCantonName(canton),
                regions: {}
            };
        }
        if (!result.cantons[canton].regions[region]) {
            result.cantons[canton].regions[region] = { ageClasses: {} };
        }
        if (!result.cantons[canton].regions[region].ageClasses[ageClass]) {
            result.cantons[canton].regions[region].ageClasses[ageClass] = { models: {} };
        }
        if (!result.cantons[canton].regions[region].ageClasses[ageClass].models[model]) {
            result.cantons[canton].regions[region].ageClasses[ageClass].models[model] = { insurers: [] };
        }

        // Trouver ou créer l'assureur dans le modèle
        const modelData = result.cantons[canton].regions[region].ageClasses[ageClass].models[model];
        let insurer = modelData.insurers.find(i => i.name === insurerName && i.product === tarifName);

        if (!insurer) {
            insurer = {
                name: insurerName,
                product: tarifName,
                premiums: {
                    withAccident: {},
                    withoutAccident: {}
                }
            };
            modelData.insurers.push(insurer);
        }

        // Ajouter la prime
        insurer.premiums[accidentType][franchise] = parseFloat(premium);
        processed++;
    }

    console.log(`✅ ${processed} primes traitées, ${skipped} lignes ignorées`);

    // Trier les assureurs par prime (franchise 300, avec accident) dans chaque modèle
    for (const canton of Object.values(result.cantons)) {
        for (const region of Object.values(canton.regions)) {
            for (const ageClass of Object.values(region.ageClasses)) {
                for (const model of Object.values(ageClass.models)) {
                    model.insurers.sort((a, b) => {
                        const priceA = a.premiums.withAccident['300'] || a.premiums.withAccident['0'] || 999999;
                        const priceB = b.premiums.withAccident['300'] || b.premiums.withAccident['0'] || 999999;
                        return priceA - priceB;
                    });
                }
            }
        }
    }

    // Créer le dossier data s'il n'existe pas
    const dataDir = path.dirname(outputFile);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Écrire le fichier JSON
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');
    console.log(`💾 Fichier généré: ${outputFile}`);

    // Stats
    const cantonCount = Object.keys(result.cantons).length;
    console.log(`📈 ${cantonCount} cantons traités`);
}

function getCantonName(code) {
    const names = {
        'AG': 'Argovie', 'AI': 'Appenzell RI', 'AR': 'Appenzell RE',
        'BE': 'Berne', 'BL': 'Bâle-Campagne', 'BS': 'Bâle-Ville',
        'FR': 'Fribourg', 'GE': 'Genève', 'GL': 'Glaris',
        'GR': 'Grisons', 'JU': 'Jura', 'LU': 'Lucerne',
        'NE': 'Neuchâtel', 'NW': 'Nidwald', 'OW': 'Obwald',
        'SG': 'Saint-Gall', 'SH': 'Schaffhouse', 'SO': 'Soleure',
        'SZ': 'Schwytz', 'TG': 'Thurgovie', 'TI': 'Tessin',
        'UR': 'Uri', 'VD': 'Vaud', 'VS': 'Valais',
        'ZG': 'Zoug', 'ZH': 'Zurich'
    };
    return names[code] || code;
}

main();
