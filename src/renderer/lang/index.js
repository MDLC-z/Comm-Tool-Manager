const translations = {};

async function loadLanguage(langCode) {
    try {
        const response = await fetch(`./lang/${langCode}.json`);
        if (!response.ok) throw new Error(`Idioma ${langCode} no encontrado`);
        translations[langCode] = await response.json();
        return translations[langCode];
    } catch (error) {
        console.error('Error cargando idioma:', error);
        if (langCode !== 'en') return loadLanguage('en');
        throw error;
    }
}

async function loadAllLanguages() {
    const languages = ['en', 'es', 'kl', 'ac', 'mw', 'uwu'];
    for (const lang of languages) await loadLanguage(lang);
}

function getTranslation(langCode, key) {
    const langTranslations = translations[langCode];
    if (!langTranslations) return null;
    
    const keys = key.split('.');
    let value = langTranslations;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return null;
        }
    }
    
    return value;
}

const availableLanguages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'kl', name: 'Klingon', nativeName: 'tlhIngan Hol' },
    { code: 'ac', name: 'Animal', nativeName: 'A Ni Mal' },
    { code: 'mw', name: 'Meow', nativeName: 'Mee-ow'},
    { code: 'uwu', name: 'UWU', nativeName: 'UWU'},
];

export { translations, loadLanguage, loadAllLanguages, getTranslation, availableLanguages };