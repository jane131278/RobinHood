/**
 * Service de comparaison des primes LAMal
 * Utilise les données OFSP 2026
 */

import insuranceData from '../data/swiss-insurance-2026.json';

/**
 * Obtenir les offres d'assurance pour un profil donné
 * @param {string} canton - Code canton (ex: 'GE', 'VD', 'ZH')
 * @param {string} region - Numéro de région (0, 1, 2)
 * @param {string} ageClass - 'child', 'youngAdult', 'adult'
 * @param {string} model - 'standard', 'telmed', 'familyDoctor', 'hmo'
 * @param {string} franchise - '0', '300', '500', '1000', '1500', '2000', '2500'
 * @param {boolean} withAccident - true si couverture accident incluse
 * @returns {Array} Liste des offres triées par prix
 */
export function getOffers(canton, region = '0', ageClass, model, franchise, withAccident = true) {
    const accidentKey = withAccident ? 'withAccident' : 'withoutAccident';

    try {
        const insurers = insuranceData.cantons[canton]?.regions[region]?.ageClasses[ageClass]?.models[model]?.insurers || [];

        return insurers
            .map(ins => ({
                name: ins.name,
                product: ins.product,
                price: ins.premiums[accidentKey]?.[franchise]
            }))
            .filter(o => o.price !== null && o.price !== undefined)
            .sort((a, b) => a.price - b.price);
    } catch (error) {
        console.error('Erreur getOffers:', error);
        return [];
    }
}

/**
 * Obtenir la prime la moins chère pour un profil
 */
export function getCheapestOffer(canton, region, ageClass, model, franchise, withAccident = true) {
    const offers = getOffers(canton, region, ageClass, model, franchise, withAccident);
    return offers[0] || null;
}

/**
 * Comparer la prime actuelle avec les meilleures offres du marché
 * @param {Object} currentPolicy - Police actuelle avec { assureur, prime_mensuelle, franchise, modele, canton, region, ageClass, withAccident }
 * @returns {Object} Comparaison avec économies potentielles
 */
export function comparePremium(currentPolicy) {
    const {
        assureur,
        prime_mensuelle,
        franchise,
        modele = 'standard',
        canton = 'GE',
        region = '0',
        ageClass = 'adult',
        withAccident = true
    } = currentPolicy;

    // Obtenir toutes les offres pour le même profil
    const allOffers = getOffers(canton, region, ageClass, modele, String(franchise), withAccident);

    // Meilleure offre
    const bestOffer = allOffers[0];

    // Prime actuelle vs meilleure offre
    const currentPrice = parseFloat(prime_mensuelle);
    const bestPrice = bestOffer?.price || currentPrice;
    const monthlySavings = currentPrice - bestPrice;
    const yearlySavings = monthlySavings * 12;

    // Trouver le rang de l'assureur actuel
    const currentRank = allOffers.findIndex(o =>
        o.name.toLowerCase().includes(assureur.toLowerCase()) ||
        assureur.toLowerCase().includes(o.name.toLowerCase())
    ) + 1;

    return {
        currentPrice,
        bestOffer,
        bestPrice,
        monthlySavings,
        yearlySavings,
        percentSavings: currentPrice > 0 ? (monthlySavings / currentPrice * 100).toFixed(1) : 0,
        currentRank: currentRank || null,
        totalOffers: allOffers.length,
        top5Offers: allOffers.slice(0, 5),
        isOptimal: monthlySavings <= 5 // Moins de 5 CHF de différence = optimal
    };
}

/**
 * Obtenir les économies possibles avec différentes franchises
 */
export function getFranchiseComparison(canton, region, ageClass, model, withAccident = true) {
    const franchises = ageClass === 'child'
        ? ['0', '100', '200', '300', '400', '500', '600']
        : ['300', '500', '1000', '1500', '2000', '2500'];

    return franchises.map(franchise => {
        const offers = getOffers(canton, region, ageClass, model, franchise, withAccident);
        const cheapest = offers[0];
        return {
            franchise: parseInt(franchise),
            cheapestPrice: cheapest?.price || null,
            cheapestInsurer: cheapest?.name || null,
            offersCount: offers.length
        };
    });
}

/**
 * Obtenir la liste des cantons disponibles
 */
export function getCantons() {
    return Object.entries(insuranceData.cantons).map(([code, data]) => ({
        code,
        name: data.name
    }));
}

/**
 * Obtenir les régions d'un canton
 */
export function getRegions(canton) {
    const cantonData = insuranceData.cantons[canton];
    if (!cantonData) return [];
    return Object.keys(cantonData.regions);
}

/**
 * Mapper un modèle vers son nom français
 */
export function getModelName(model) {
    const names = {
        standard: 'Standard (libre choix)',
        telmed: 'Télémédecine',
        familyDoctor: 'Médecin de famille',
        hmo: 'HMO / Réseau'
    };
    return names[model] || model;
}

/**
 * Détecter le modèle depuis le nom du produit
 */
export function detectModelFromProduct(productName) {
    if (!productName) return 'standard';

    const name = productName.toLowerCase();

    if (name.includes('hmo') || name.includes('sanacare') || name.includes('medbase')) {
        return 'hmo';
    }
    if (name.includes('telmed') || name.includes('callmed') || name.includes('24') || name.includes('arcosana')) {
        return 'telmed';
    }
    if (name.includes('hausarzt') || name.includes('médecin') || name.includes('famille') || name.includes('praxis')) {
        return 'familyDoctor';
    }

    return 'standard';
}

export default {
    getOffers,
    getCheapestOffer,
    comparePremium,
    getFranchiseComparison,
    getCantons,
    getRegions,
    getModelName,
    detectModelFromProduct
};
