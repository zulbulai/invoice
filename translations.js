/**
 * InvioLite Translation System
 * Handles multi-language support
 * 
 * Copyright (c) 2025 InvioLite. All rights reserved.
 * Commercial License - See LICENSE.md for full terms
 */

class TranslationManager {
    constructor() {
        this.translations = {};
        this.currentLanguage = 'tr';
        this.fallbackLanguage = 'en';
    }

    async loadTranslations() {
        try {
            const response = await fetch('translations.json');
            this.translations = await response.json();
            
            // Load saved language preference
            const savedLang = localStorage.getItem('violite_language');
            if (savedLang && this.translations[savedLang]) {
                this.currentLanguage = savedLang;
            } else {
                // Detect browser language
                const browserLang = navigator.language.split('-')[0];
                this.currentLanguage = this.translations[browserLang] ? browserLang : 'tr';
            }
            
            // Set HTML lang attribute
            document.documentElement.lang = this.currentLanguage;
            
            return true;
        } catch (error) {
            console.error('Failed to load translations:', error);
            return false;
        }
    }

    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];
        
        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                // Try fallback language
                value = this.translations[this.fallbackLanguage];
                for (const fk of keys) {
                    if (value && value[fk]) {
                        value = value[fk];
                    } else {
                        return key; // Return key if translation not found
                    }
                }
                break;
            }
        }
        
        // Replace placeholders
        if (typeof value === 'string' && params) {
            Object.keys(params).forEach(param => {
                value = value.replace(`{${param}}`, params[param]);
            });
        }
        
        return value || key;
    }

    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLanguage = lang;
            localStorage.setItem('violite_language', lang);
            document.documentElement.lang = lang;
            return true;
        }
        return false;
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getAvailableLanguages() {
        return Object.keys(this.translations);
    }
}

// Global translation manager instance
window.translationManager = new TranslationManager();

