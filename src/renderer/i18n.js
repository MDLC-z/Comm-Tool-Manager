import { loadLanguage, loadAllLanguages, getTranslation, availableLanguages } from './lang/index.js';

const i18n = {
    currentLanguage: 'en',
    
    async init() {
        try {
            await loadAllLanguages();
            await this.loadSavedLanguage();
            await this.applyTranslations();
            this.setupDynamicListeners();
        } catch (error) {
            console.error('Error inicializando i18n:', error);
            this.currentLanguage = 'en';
            await this.applyTranslations();
        }
    },
    
    async loadSavedLanguage() {
        try {
            const savedLanguage = localStorage.getItem('app-language');
            console.log('Idioma guardado encontrado:', savedLanguage);
            
            if (savedLanguage && this.isLanguageAvailable(savedLanguage)) {
                this.currentLanguage = savedLanguage;
                console.log('Idioma cargado desde localStorage:', savedLanguage);
            } else {
                // Detectar idioma del navegador
                const browserLang = navigator.language.split('-')[0];
                if (this.isLanguageAvailable(browserLang)) {
                    this.currentLanguage = browserLang;
                    console.log('Idioma detectado del navegador:', browserLang);
                } else {
                    this.currentLanguage = 'en';
                    console.log('Idioma por defecto (en)');
                }
                
                // Guardar el idioma detectado
                localStorage.setItem('app-language', this.currentLanguage);
            }
            
            this.updateLanguageSelect();
            
        } catch (error) {
            console.error('Error cargando idioma guardado:', error);
            this.currentLanguage = 'en';
        }
    },
    
    isLanguageAvailable(langCode) {
        const isAvailable = availableLanguages.some(lang => lang.code === langCode) && 
                           getTranslation(langCode, 'welcome.title');
        console.log(`¿Idioma ${langCode} disponible?`, isAvailable);
        return isAvailable;
    },
    
    async changeLanguage(langCode) {
        if (!this.isLanguageAvailable(langCode)) {
            console.warn(`Idioma ${langCode} no disponible`);
            return false;
        }
        
        console.log('Cambiando idioma a:', langCode);
        
        try {
            this.currentLanguage = langCode;
            localStorage.setItem('app-language', langCode);
            console.log('Idioma guardado en localStorage:', langCode);
            
            await this.applyTranslations();
            this.updateLanguageSelect();
            
            // Disparar evento para elementos dinámicos
            document.dispatchEvent(new CustomEvent('languageChanged', {
                detail: { language: langCode }
            }));
            
            return true;
            
        } catch (error) {
            console.error('Error cambiando idioma:', error);
            return false;
        }
    },
    
    async applyTranslations() {
        console.log('Aplicando traducciones para:', this.currentLanguage);
        
        try {
            // Traducir elementos estáticos
            const elements = document.querySelectorAll('[data-i18n]');
            elements.forEach(element => {
                const key = element.getAttribute('data-i18n');
                const translation = this.translate(key);
                
                if (translation) {
                    const attr = element.getAttribute('data-i18n-attr');
                    if (attr) {
                        element.setAttribute(attr, translation);
                    } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                        element.placeholder = translation;
                    } else if (element.tagName === 'IMG') {
                        element.alt = translation;
                    } else if (element.tagName === 'OPTION') {
                        // Manejar opciones con flecha
                        element.textContent = translation.includes('▼') ? translation : translation;
                    } else {
                        element.textContent = translation;
                    }
                }
            });
            
            // Actualizar título de la página
            const title = this.translate('app_title');
            if (title) {
                document.title = title;
                console.log('Título actualizado:', title);
            }
            
            // Actualizar elementos dinámicos (como el sort)
            this.updateDynamicElements();
            
            console.log('Traducciones aplicadas correctamente');
            
        } catch (error) {
            console.error('Error aplicando traducciones:', error);
        }
    },
    
    updateDynamicElements() {
        // Actualizar opciones de ordenamiento
        this.updateSortOptions();
        
        // Actualizar otros elementos dinámicos aquí si es necesario
    },
    
    updateSortOptions() {
        const sortSelect = document.getElementById('sort-select');
        if (!sortSelect) return;
        
        const options = sortSelect.querySelectorAll('option');
        options.forEach(option => {
            const sortKey = option.value;
            if (sortKey) {
                const translationKey = `sort.${sortKey}`;
                const translation = this.translate(translationKey);
                if (translation && translation !== translationKey) {
                    option.textContent = translation;
                }
            }
        });
    },
    
    setupDynamicListeners() {
        // Escuchar cambios de idioma para actualizar elementos dinámicos
        document.addEventListener('languageChanged', () => {
            this.updateDynamicElements();
        });
    },
    
    translate(key, params = {}) {
        let translation = getTranslation(this.currentLanguage, key) || 
                         getTranslation('en', key) || 
                         key;
        
        // Aplicar parámetros si existen
        if (params && typeof params === 'object') {
            Object.keys(params).forEach(param => {
                const placeholder = `{${param}}`;
                if (translation.includes(placeholder)) {
                    translation = translation.replace(
                        new RegExp(placeholder, 'g'), 
                        params[param]
                    );
                }
            });
        }
        
        return translation;
    },
    
    updateLanguageSelect() {
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.value = this.currentLanguage;
            console.log('Select de idioma actualizado a:', this.currentLanguage);
        }
    },
    
    getCurrentLanguage() { 
        return this.currentLanguage; 
    },
    
    getAvailableLanguages() { 
        return availableLanguages; 
    },
    
    // Método para obtener información del idioma actual
    getCurrentLanguageInfo() {
        return availableLanguages.find(lang => lang.code === this.currentLanguage) || 
               availableLanguages.find(lang => lang.code === 'en');
    },
    
    // Método público para forzar actualización
    refresh() {
        this.applyTranslations();
    },
    
    // Método para verificar el estado actual
    debug() {
        console.log('=== DEBUG i18n ===');
        console.log('Idioma actual:', this.currentLanguage);
        console.log('Idioma en localStorage:', localStorage.getItem('app-language'));
        console.log('Idiomas disponibles:', availableLanguages.map(lang => lang.code));
        console.log('Traducción de prueba:', this.translate('welcome.title'));
        console.log('==================');
    }
};

// Funciones globales para usar en HTML
function changeLanguage(langCode) { 
    return i18n.changeLanguage(langCode);
}

function t(key, params) { 
    return i18n.translate(key, params); 
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando i18n...');
    i18n.init().then(() => {
        console.log('i18n inicializado correctamente');
        i18n.debug(); // Debug inicial
    });
});

// Hacer disponible globalmente
window.i18n = i18n;
window.changeLanguage = changeLanguage;
window.t = t;

export default i18n;