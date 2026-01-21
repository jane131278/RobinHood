// LocalStorage Service for JANE+
const STORAGE_KEYS = {
    POLICIES: 'janeplus_policies',
    CHAT_HISTORY: 'janeplus_chat',
    ANALYSIS_CACHE: 'janeplus_analysis',
    SETTINGS: 'janeplus_settings'
};

// Policies
export function savePolicies(policies) {
    localStorage.setItem(STORAGE_KEYS.POLICIES, JSON.stringify(policies));
}

export function getPolicies() {
    const data = localStorage.getItem(STORAGE_KEYS.POLICIES);
    return data ? JSON.parse(data) : [];
}

export function addPolicy(policy) {
    const policies = getPolicies();
    const newPolicy = {
        ...policy,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString()
    };
    policies.push(newPolicy);
    savePolicies(policies);
    return newPolicy;
}

export function updatePolicy(id, updates) {
    const policies = getPolicies();
    const index = policies.findIndex(p => p.id === id);
    if (index !== -1) {
        policies[index] = { ...policies[index], ...updates };
        savePolicies(policies);
        return policies[index];
    }
    return null;
}

export function deletePolicy(id) {
    const policies = getPolicies().filter(p => p.id !== id);
    savePolicies(policies);
}

// Chat History
export function saveChatHistory(messages) {
    localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(messages));
}

export function getChatHistory() {
    const data = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
    return data ? JSON.parse(data) : [];
}

export function clearChatHistory() {
    localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
}

// Analysis Cache
export function saveAnalysisCache(analysis) {
    localStorage.setItem(STORAGE_KEYS.ANALYSIS_CACHE, JSON.stringify({
        ...analysis,
        cached_at: new Date().toISOString()
    }));
}

export function getAnalysisCache() {
    const data = localStorage.getItem(STORAGE_KEYS.ANALYSIS_CACHE);
    if (!data) return null;

    const analysis = JSON.parse(data);
    // Cache expires after 1 hour
    const cacheAge = Date.now() - new Date(analysis.cached_at).getTime();
    if (cacheAge > 3600000) {
        localStorage.removeItem(STORAGE_KEYS.ANALYSIS_CACHE);
        return null;
    }
    return analysis;
}

// Settings
export function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function getSettings() {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
        notifications: true,
        theme: 'light'
    };
}

// Clear all data
export function clearAllData() {
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
}
