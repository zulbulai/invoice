/**
 * InvioLite - Professional Invoice Generator
 * Secure, production-ready invoice generator with PDF export
 * 
 * Copyright (c) 2025 InvioLite. All rights reserved.
 * 
 * Commercial License - See LICENSE.md for full terms
 * This software is licensed, not sold.
 * 
 * For licensing inquiries: info@imgera.com
 */

class InvoiceGenerator {
    constructor() {
        this.items = [];
        this.settings = {
            taxRate: 20,
            discount: 0,
            discountType: 'percent' // 'percent' or 'fixed'
        };
        this.translationsReady = false;
        this.config = null;
        this.init();
    }

    async init() {
        // Load config first
        await this.loadConfig();
        
        // Apply template (loads HTML and CSS)
        await this.applyTemplate();
        
        // Wait for translations to load
        if (window.translationManager) {
            this.translationsReady = await window.translationManager.loadTranslations();
            // Update HTML lang attribute based on loaded language
            document.documentElement.lang = window.translationManager.getCurrentLanguage();
            this.applyTranslations();
        }
        
        this.loadFromStorage();
        this.setupDOM();
        this.setupEventListeners();
        this.initializeDates();
        this.applyCompanyConfig();
        this.renderItems();
        this.updatePreview();
    }

    async applyTemplate() {
        if (!this.config || !this.config.template) return;
        
        const templateName = this.config.template.name || 'template-1';
        const previewWrapper = document.querySelector('.preview-wrapper');
        if (!previewWrapper) return;
        
        // Load CSS
        const templateLink = document.getElementById('templateStylesheet');
        if (templateLink) {
            templateLink.href = `templates/${templateName}.css`;
        }
        
        // Load HTML for templates 3, 4, 5 (they have different HTML structures)
        if (['template-3', 'template-4', 'template-5'].includes(templateName)) {
            try {
                const htmlResponse = await fetch(`templates/${templateName}-${templateName.split('-')[1]}.html`);
                const htmlContent = await htmlResponse.text();
                
                // Replace the invoice preview content
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;
                const newPreview = tempDiv.querySelector('#invoicePreview');
                
                if (newPreview && previewWrapper) {
                    const oldPreview = previewWrapper.querySelector('#invoicePreview');
                    if (oldPreview) {
                        oldPreview.replaceWith(newPreview);
                    } else {
                        previewWrapper.appendChild(newPreview);
                    }
                    
                    // Re-setup DOM elements after template change
                    this.setupDOM();
                    this.setupEventListeners();
                }
            } catch (error) {
                console.error('Failed to load template HTML:', error);
            }
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('config.json');
            this.config = await response.json();
            
            // Apply branding colors if available
            if (this.config.branding) {
                this.applyBranding();
            }
            
            return true;
        } catch (error) {
            console.error('Failed to load config:', error);
            // Use default config
            this.config = {
                company: {
                    name: "InvioLite",
                    logo: "logo.png",
                    address: {
                        line1: "Company Address Line 1",
                        line2: "City / State"
                    },
                    contact: {
                        email: "info@imgera.com",
                        phone: "+1 555 000 0000",
                        website: "imgera.com"
                    }
                },
                invoice: {
                    defaultNumber: "INV-001",
                    defaultTaxRate: 20,
                    currency: "TRY"
                }
            };
            return false;
        }
    }

    applyBranding() {
        if (!this.config.branding) return;
        
        const root = document.documentElement;
        if (this.config.branding.primaryColor) {
            root.style.setProperty('--brand-primary', this.config.branding.primaryColor);
        }
        if (this.config.branding.headerBarColor) {
            const headerBar = document.querySelector('.header-bar');
            if (headerBar) {
                headerBar.style.backgroundColor = this.config.branding.headerBarColor;
            }
        }
    }

    applyCompanyConfig() {
        if (!this.config || !this.config.company) return;

        const company = this.config.company;
        
        // Update company name in preview
        const companyNameEl = document.querySelector('.company-name');
        if (companyNameEl && company.name) {
            companyNameEl.textContent = company.name.toUpperCase();
        }
        
        // Update company address
        const companyInfoBlock = document.querySelector('.company-info-block');
        if (companyInfoBlock) {
            const divs = companyInfoBlock.querySelectorAll('div');
            if (divs.length >= 2 && company.address) {
                if (company.address.line1) {
                    divs[1].textContent = company.address.line1;
                }
                if (company.address.line2) {
                    divs[2].textContent = company.address.line2;
                }
                if (company.contact && company.contact.email) {
                    divs[3].textContent = company.contact.email;
                }
                if (company.contact && company.contact.phone) {
                    divs[4].textContent = company.contact.phone;
                }
            }
        }
        
        // Update logo sources with fallback to company name
        const logos = document.querySelectorAll('.logo, .footer-logo-img, img[src="logo.png"]');
        logos.forEach(img => {
            if (company.logo) {
                img.src = company.logo;
                img.alt = company.name || 'Company Logo';
                
                // Handle logo load error - show company name instead
                img.onerror = () => {
                    img.style.display = 'none';
                    this.showCompanyNameAsLogo(img, company.name);
                };
            } else {
                // No logo configured, show company name
                img.style.display = 'none';
                this.showCompanyNameAsLogo(img, company.name);
            }
        });
        
        // Update footer based on config
        this.applyFooterConfig();
        
        // Update default invoice number if set
        if (this.config.invoice && this.config.invoice.defaultNumber) {
            const invoiceNumberInput = document.getElementById('invoiceNumber');
            if (invoiceNumberInput && !invoiceNumberInput.value) {
                invoiceNumberInput.value = this.config.invoice.defaultNumber;
            }
        }
        
        // Update default tax rate if set
        if (this.config.invoice && this.config.invoice.defaultTaxRate) {
            const taxRateInput = document.getElementById('taxRate');
            if (taxRateInput && taxRateInput.value === '20') {
                taxRateInput.value = this.config.invoice.defaultTaxRate;
                this.settings.taxRate = this.config.invoice.defaultTaxRate;
            }
        }
        
        // Update default currency if set
        if (this.config.invoice && this.config.invoice.currency) {
            const currencySelect = document.getElementById('currency');
            if (currencySelect) {
                currencySelect.value = this.config.invoice.currency;
            }
        }
    }

    showCompanyNameAsLogo(imgElement, companyName) {
        if (!companyName) return;
        
        // Find the parent container
        const container = imgElement.closest('.brand-col, .footer-logo');
        if (!container) return;
        
        // Check if text logo already exists
        if (container.querySelector('.text-logo')) return;
        
        // Create text logo element
        const textLogo = document.createElement('div');
        textLogo.className = 'text-logo';
        textLogo.textContent = companyName.toUpperCase();
        textLogo.style.cssText = 'font-family: \'Outfit\', sans-serif; font-weight: 700; font-size: 1.5rem; color: var(--paper-accent, #0f172a); text-align: left; line-height: 1.2;';
        
        // Insert before or replace the img
        if (imgElement.parentNode) {
            imgElement.parentNode.insertBefore(textLogo, imgElement);
        }
    }

    applyFooterConfig() {
        const footer = document.querySelector('.invoice-footer');
        if (!footer) return;

        // Check if footer is enabled
        const footerConfig = this.config.footer || {};
        if (footerConfig.enabled === false) {
            footer.style.display = 'none';
            return;
        } else {
            footer.style.display = '';
        }

        const company = this.config.company;
        if (!company) return;

        // Handle footer logo
        const footerLogo = footer.querySelector('.footer-logo');
        if (footerLogo) {
            if (footerConfig.showLogo === false) {
                footerLogo.style.display = 'none';
            } else {
                footerLogo.style.display = '';
                const logoImg = footerLogo.querySelector('img');
                if (logoImg && !company.logo) {
                    // If no logo, show company name
                    logoImg.style.display = 'none';
                    if (!footerLogo.querySelector('.text-logo')) {
                        const textLogo = document.createElement('div');
                        textLogo.className = 'text-logo';
                        textLogo.textContent = company.name || 'InvioLite';
                        footerLogo.appendChild(textLogo);
                    }
                }
            }
        }

        // Update footer info
        const footerInfo = footer.querySelector('.footer-info');
        if (footerInfo && footerConfig.showCompanyInfo !== false) {
            const infoLines = [];
            
            // Company name
            if (company.name) {
                infoLines.push(`<strong>${company.name}</strong>`);
            }
            
            // Address
            if (footerConfig.showAddress !== false && company.address) {
                if (company.address.line1) {
                    infoLines.push(company.address.line1);
                }
                if (company.address.line2) {
                    infoLines.push(company.address.line2);
                }
            }
            
            // Email
            if (footerConfig.showEmail !== false && company.contact && company.contact.email) {
                infoLines.push(company.contact.email);
            }
            
            // Phone
            if (footerConfig.showPhone !== false && company.contact && company.contact.phone) {
                infoLines.push(company.contact.phone);
            }
            
            // Website (only show once)
            if (footerConfig.showWebsite !== false && company.contact && company.contact.website) {
                infoLines.push(company.contact.website);
            }
            
            footerInfo.innerHTML = infoLines.join('<br>');
        } else if (footerInfo && footerConfig.showCompanyInfo === false) {
            footerInfo.style.display = 'none';
        }
    }

    t(key, params = {}) {
        if (window.translationManager && this.translationsReady) {
            return window.translationManager.t(key, params);
        }
        return key;
    }

    applyTranslations() {
        if (!this.translationsReady) return;

        // Update document title and meta
        document.title = this.t('app.title');
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.content = this.t('app.description');
        }

        // Apply translations to elements with data-translate attribute
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.getAttribute('data-translate');
            const params = el.dataset.params ? JSON.parse(el.dataset.params) : {};
            el.textContent = this.t(key, params);
        });

        // Update placeholders
        document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
            const key = el.getAttribute('data-translate-placeholder');
            el.placeholder = this.t(key);
        });

        // Update aria-labels
        document.querySelectorAll('[data-translate-aria]').forEach(el => {
            const key = el.getAttribute('data-translate-aria');
            el.setAttribute('aria-label', this.t(key));
        });

        // Update select options
        this.updateSelectOptions();
    }

    updateSelectOptions() {
        // Document types
        const docTypeSelect = document.getElementById('docType');
        if (docTypeSelect) {
            Array.from(docTypeSelect.options).forEach(option => {
                const key = `documentTypes.${option.value}`;
                option.textContent = this.t(key);
            });
        }

        // Currencies
        const currencySelect = document.getElementById('currency');
        if (currencySelect) {
            Array.from(currencySelect.options).forEach(option => {
                const key = `currencies.${option.value}`;
                option.textContent = this.t(key);
            });
        }

        // Discount type
        const discountTypeSelect = document.getElementById('discountType');
        if (discountTypeSelect) {
            Array.from(discountTypeSelect.options).forEach(option => {
                const key = option.value === 'percent' ? 'ui.percent' : 'ui.fixed';
                option.textContent = this.t(key);
            });
        }
    }

    setupDOM() {
        this.elements = {
            form: document.getElementById('invoiceForm'),
            itemsContainer: document.getElementById('itemsContainer'),
            addItemBtn: document.getElementById('addItemBtn'),
            printBtn: document.getElementById('printBtn'),
            pdfBtn: document.getElementById('pdfBtn'),
            exportBtn: document.getElementById('exportBtn'),
            importBtn: document.getElementById('importBtn'),
            importInput: document.getElementById('importInput'),
            saveBtn: document.getElementById('saveBtn'),
            taxRateInput: document.getElementById('taxRate'),
            discountInput: document.getElementById('discount'),
            discountTypeSelect: document.getElementById('discountType'),
            previewDate: document.getElementById('previewDate'),
            previewExpiryInline: document.getElementById('previewExpiryInline'),
            previewDocTypeDisplay: document.getElementById('previewDocTypeDisplay'),
            previewNumberDisplay: document.getElementById('previewNumberDisplay'),
            previewCustomerName: document.getElementById('previewCustomerName'),
            previewCustomerAddress: document.getElementById('previewCustomerAddress'),
            previewCustomerPhone: document.getElementById('previewCustomerPhone'),
            previewItemsBody: document.getElementById('previewItemsBody'),
            previewNotes: document.getElementById('previewNotes'),
            previewSubtotal: document.getElementById('previewSubtotal'),
            previewTax: document.getElementById('previewTax'),
            previewTotal: document.getElementById('previewTotal'),
            notification: document.getElementById('notification')
        };
        
        // Re-query elements that might have changed after template switch
        if (!this.elements.previewDate) {
            this.elements.previewDate = document.getElementById('previewDate');
        }
        if (!this.elements.previewExpiryInline) {
            this.elements.previewExpiryInline = document.getElementById('previewExpiryInline');
        }
        if (!this.elements.previewDocTypeDisplay) {
            this.elements.previewDocTypeDisplay = document.getElementById('previewDocTypeDisplay');
        }
        if (!this.elements.previewNumberDisplay) {
            this.elements.previewNumberDisplay = document.getElementById('previewNumberDisplay');
        }
        if (!this.elements.previewCustomerName) {
            this.elements.previewCustomerName = document.getElementById('previewCustomerName');
        }
        if (!this.elements.previewCustomerAddress) {
            this.elements.previewCustomerAddress = document.getElementById('previewCustomerAddress');
        }
        if (!this.elements.previewCustomerPhone) {
            this.elements.previewCustomerPhone = document.getElementById('previewCustomerPhone');
        }
        if (!this.elements.previewItemsBody) {
            this.elements.previewItemsBody = document.getElementById('previewItemsBody');
        }
        if (!this.elements.previewNotes) {
            this.elements.previewNotes = document.getElementById('previewNotes');
        }
        if (!this.elements.previewSubtotal) {
            this.elements.previewSubtotal = document.getElementById('previewSubtotal');
        }
        if (!this.elements.previewTax) {
            this.elements.previewTax = document.getElementById('previewTax');
        }
        if (!this.elements.previewTotal) {
            this.elements.previewTotal = document.getElementById('previewTotal');
        }
    }

    setupEventListeners() {
        this.elements.form?.addEventListener('input', () => {
            this.updatePreview();
            this.autoSave();
        });
        
        this.elements.addItemBtn?.addEventListener('click', () => this.addItem());
        this.elements.printBtn?.addEventListener('click', () => this.printInvoice());
        this.elements.pdfBtn?.addEventListener('click', () => this.generatePDF());
        this.elements.exportBtn?.addEventListener('click', () => this.exportData());
        this.elements.importBtn?.addEventListener('click', () => this.elements.importInput?.click());
        this.elements.importInput?.addEventListener('change', (e) => this.importData(e));
        this.elements.saveBtn?.addEventListener('click', () => this.saveToStorage());

        // Language switcher
        const langSelect = document.getElementById('languageSelect');
        if (langSelect && window.translationManager) {
            langSelect.value = window.translationManager.getCurrentLanguage();
            langSelect.addEventListener('change', (e) => {
                if (window.translationManager) {
                    window.translationManager.setLanguage(e.target.value);
                    this.applyTranslations();
                    this.renderItems();
                    this.updatePreview();
                }
            });
        }
        
        this.elements.taxRateInput?.addEventListener('input', (e) => {
            this.settings.taxRate = parseFloat(e.target.value) || 0;
            this.updatePreview();
        });
        
        this.elements.discountInput?.addEventListener('input', (e) => {
            this.settings.discount = parseFloat(e.target.value) || 0;
            this.updatePreview();
        });
        
        this.elements.discountTypeSelect?.addEventListener('change', (e) => {
            this.settings.discountType = e.target.value;
            this.updatePreview();
        });

        document.getElementById('currency')?.addEventListener('change', () => this.updatePreview());
    }

    initializeDates() {
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        const issueDateInput = document.getElementById('issueDate');
        const expiryDateInput = document.getElementById('expiryDate');
        
        if (issueDateInput && !issueDateInput.value) {
            issueDateInput.value = today.toISOString().split('T')[0];
        }
        if (expiryDateInput && !expiryDateInput.value) {
            expiryDateInput.value = nextMonth.toISOString().split('T')[0];
        }
    }

    addItem() {
        const newItem = {
            id: Date.now(),
            description: '',
            qty: 1,
            price: 0
        };
        this.items.push(newItem);
        this.renderItems();
        this.updatePreview();
        this.showNotification(this.t('notifications.itemAdded'), 'success');
    }

    removeItem(id) {
        if (this.items.length > 1) {
            this.items = this.items.filter(item => item.id !== id);
            this.renderItems();
            this.updatePreview();
            this.showNotification(this.t('notifications.itemRemoved'), 'success');
        } else {
            this.showNotification(this.t('notifications.minItemsRequired'), 'error');
        }
    }

    updateItem(id, field, value) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;

        if (field === 'qty' || field === 'price') {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
                item[field] = 0;
            } else {
                item[field] = numValue;
            }
        } else {
            // Sanitize text input to prevent XSS
            item[field] = this.sanitizeInput(value);
        }
        this.updatePreview();
    }

    sanitizeInput(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    renderItems() {
        if (!this.elements.itemsContainer) return;
        
        this.elements.itemsContainer.innerHTML = '';
        
        this.items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'item-row';
            row.setAttribute('data-item-id', item.id);
            
            const rowHeader = document.createElement('div');
            rowHeader.className = 'item-row-header';
            
            const label = document.createElement('span');
            label.className = 'text-muted';
            label.textContent = `${this.t('ui.item')} #${index + 1}`;
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn-remove';
            removeBtn.textContent = this.t('ui.remove');
            removeBtn.addEventListener('click', () => this.removeItem(item.id));
            
            rowHeader.appendChild(label);
            rowHeader.appendChild(removeBtn);
            
            const descGroup = document.createElement('div');
            descGroup.className = 'form-group';
            const descInput = document.createElement('input');
            descInput.type = 'text';
            descInput.placeholder = this.t('ui.description');
            descInput.value = item.description;
            descInput.addEventListener('input', (e) => this.updateItem(item.id, 'description', e.target.value));
            descGroup.appendChild(descInput);
            
            const grid = document.createElement('div');
            grid.className = 'form-grid';
            
            const qtyGroup = document.createElement('div');
            qtyGroup.className = 'form-group';
            const qtyLabel = document.createElement('label');
            qtyLabel.textContent = this.t('ui.quantity');
            const qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.min = '0';
            qtyInput.step = '0.01';
            qtyInput.value = item.qty;
            qtyInput.addEventListener('input', (e) => this.updateItem(item.id, 'qty', e.target.value));
            qtyGroup.appendChild(qtyLabel);
            qtyGroup.appendChild(qtyInput);
            
            const priceGroup = document.createElement('div');
            priceGroup.className = 'form-group';
            const priceLabel = document.createElement('label');
            priceLabel.textContent = this.t('ui.unitPrice');
            const priceInput = document.createElement('input');
            priceInput.type = 'number';
            priceInput.min = '0';
            priceInput.step = '0.01';
            priceInput.value = item.price;
            priceInput.addEventListener('input', (e) => this.updateItem(item.id, 'price', e.target.value));
            priceGroup.appendChild(priceLabel);
            priceGroup.appendChild(priceInput);
            
            grid.appendChild(qtyGroup);
            grid.appendChild(priceGroup);
            
            row.appendChild(rowHeader);
            row.appendChild(descGroup);
            row.appendChild(grid);
            
            this.elements.itemsContainer.appendChild(row);
        });
    }

    formatCurrency(amount) {
        const currency = document.getElementById('currency')?.value || 'TRY';
        const locale = currency === 'TRY' ? 'tr-TR' : 'en-US';
        
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency
            }).format(amount);
        } catch (e) {
            // Fallback formatting
            return `${amount.toFixed(2)} ${currency}`;
        }
    }

    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '';
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        } catch (e) {
            return '';
        }
    }

    updatePreview() {
        try {
            // Update Dates
            const issueDate = document.getElementById('issueDate')?.value || '';
            const expiryDate = document.getElementById('expiryDate')?.value || '';
            
            if (this.elements.previewDate) {
                this.elements.previewDate.textContent = this.formatDate(issueDate);
            }
            
            // Update header note with expiry date
            const headerNote = document.querySelector('.header-note');
            if (headerNote) {
                const formattedDate = expiryDate ? this.formatDate(expiryDate) : '';
                headerNote.textContent = this.t('invoice.validUntil', { date: formattedDate });
            }

            // Update Doc Type & Number
            const docType = document.getElementById('docType')?.value || 'FATURA';
            const invoiceNumber = document.getElementById('invoiceNumber')?.value || 'FAT-001';
            
            if (this.elements.previewDocTypeDisplay) {
                this.elements.previewDocTypeDisplay.textContent = docType;
            }
            if (this.elements.previewNumberDisplay) {
                this.elements.previewNumberDisplay.textContent = invoiceNumber;
            }

            // Update Customer
            const name = document.getElementById('customerName')?.value || '';
            const address = document.getElementById('customerAddress')?.value || '';
            const phone = document.getElementById('customerPhone')?.value || '';

            if (this.elements.previewCustomerName) {
                this.elements.previewCustomerName.textContent = name || this.t('invoice.defaultCustomer');
            }
            if (this.elements.previewCustomerAddress) {
                this.elements.previewCustomerAddress.textContent = address || this.t('invoice.defaultAddress');
            }
            if (this.elements.previewCustomerPhone) {
                this.elements.previewCustomerPhone.textContent = phone || this.t('invoice.defaultPhone');
            }

            // Update Items & Calculate Totals
            let subtotal = 0;
            if (this.elements.previewItemsBody) {
                this.elements.previewItemsBody.innerHTML = '';
            }

            // Check if using table structure (templates 3, 4, 5) or div structure (templates 1, 2)
            const isTableStructure = this.elements.previewItemsBody && this.elements.previewItemsBody.tagName === 'TBODY';
            
            this.items.forEach(item => {
                const total = (item.qty || 0) * (item.price || 0);
                subtotal += total;

                if (this.elements.previewItemsBody) {
                    if (isTableStructure) {
                        // Table structure for templates 3, 4, 5
                        const row = document.createElement('tr');
                        
                        const desc = document.createElement('td');
                        desc.className = 'col-desc';
                        desc.textContent = item.description || this.t('invoice.defaultDescription');
                        
                        const qty = document.createElement('td');
                        qty.className = 'col-qty';
                        qty.textContent = item.qty || 0;
                        
                        const price = document.createElement('td');
                        price.className = 'col-price';
                        price.textContent = this.formatCurrency(item.price || 0);
                        
                        const totalCol = document.createElement('td');
                        totalCol.className = 'col-total';
                        totalCol.textContent = this.formatCurrency(total);
                        
                        row.appendChild(desc);
                        row.appendChild(qty);
                        row.appendChild(price);
                        row.appendChild(totalCol);
                        
                        this.elements.previewItemsBody.appendChild(row);
                    } else {
                        // Div structure for templates 1, 2
                        const row = document.createElement('div');
                        row.className = 'item-row-display';
                        
                        const desc = document.createElement('div');
                        desc.className = 'col-desc';
                        desc.textContent = item.description || this.t('invoice.defaultDescription');
                        
                        const price = document.createElement('div');
                        price.className = 'col-price';
                        price.textContent = this.formatCurrency(item.price || 0);
                        
                        const qty = document.createElement('div');
                        qty.className = 'col-qty';
                        qty.textContent = item.qty || 0;
                        
                        const totalCol = document.createElement('div');
                        totalCol.className = 'col-total';
                        totalCol.textContent = this.formatCurrency(total);
                        
                        row.appendChild(desc);
                        row.appendChild(price);
                        row.appendChild(qty);
                        row.appendChild(totalCol);
                        
                        this.elements.previewItemsBody.appendChild(row);
                    }
                }
            });

            // Calculate discount
            let discountAmount = 0;
            if (this.settings.discount > 0) {
                if (this.settings.discountType === 'percent') {
                    discountAmount = subtotal * (this.settings.discount / 100);
                } else {
                    discountAmount = this.settings.discount;
                }
            }
            const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

            // Calculate tax
            const tax = subtotalAfterDiscount * (this.settings.taxRate / 100);
            const grandTotal = subtotalAfterDiscount + tax;

            // Update totals display
            if (this.elements.previewSubtotal) {
                this.elements.previewSubtotal.textContent = this.formatCurrency(subtotal);
            }
            // Show/hide discount row
            const discountRow = document.getElementById('discountRow');
            const previewDiscount = document.getElementById('previewDiscount');
            if (discountRow) {
                discountRow.style.display = discountAmount > 0 ? '' : 'none';
            }
            if (previewDiscount) {
                previewDiscount.textContent = discountAmount > 0 ? this.formatCurrency(discountAmount) : this.formatCurrency(0);
            }
            
            // Update tax label
            const taxLabel = document.getElementById('taxLabel');
            if (taxLabel) {
                taxLabel.textContent = this.t('invoice.tax', { rate: this.settings.taxRate });
            }
            
            // Update other invoice labels
            const subtotalLabel = document.querySelector('#previewSubtotal')?.previousElementSibling?.querySelector('th');
            if (subtotalLabel) {
                subtotalLabel.textContent = this.t('invoice.subtotal');
            }
            
            const discountLabel = document.querySelector('#previewDiscount')?.previousElementSibling?.querySelector('th');
            if (discountLabel) {
                discountLabel.textContent = this.t('invoice.discount');
            }
            
            const totalLabel = document.querySelector('#previewTotal')?.previousElementSibling?.querySelector('th');
            if (totalLabel) {
                totalLabel.textContent = this.t('invoice.grandTotal');
            }
            
            // Update table headers
            const thDesc = document.querySelector('.th-desc');
            if (thDesc) thDesc.textContent = this.t('invoice.serviceProduct');
            const thPrice = document.querySelector('.th-price');
            if (thPrice) thPrice.textContent = this.t('invoice.listPrice');
            const thQty = document.querySelector('.th-qty');
            if (thQty) thQty.textContent = this.t('invoice.quantity');
            const thTotal = document.querySelector('.th-total');
            if (thTotal) thTotal.textContent = this.t('invoice.total');
            
            // Update "SAYIN" label
            const sayinLabel = document.querySelector('.sayin-label');
            if (sayinLabel) {
                sayinLabel.textContent = this.t('invoice.to');
            }
            if (this.elements.previewTax) {
                this.elements.previewTax.textContent = this.formatCurrency(tax);
            }
            if (this.elements.previewTotal) {
                this.elements.previewTotal.textContent = this.formatCurrency(grandTotal);
            }

            // Update Notes
            const notes = document.getElementById('notes')?.value || '';
            if (this.elements.previewNotes) {
                this.elements.previewNotes.textContent = notes;
            }
        } catch (error) {
            console.error('Preview update error:', error);
            this.showNotification(this.t('notifications.previewError'), 'error');
        }
    }

    printInvoice() {
        window.print();
    }

    async generatePDF() {
        try {
            // Check if html2pdf library is loaded
            if (typeof html2pdf === 'undefined') {
                this.showNotification(this.t('notifications.pdfLoading'), 'info');
                await this.loadPDFLibrary();
            }

            const element = document.getElementById('invoicePreview');
            const invoiceNum = document.getElementById('invoiceNumber')?.value || 'invoice';
            const opt = {
                margin: 0,
                filename: `${invoiceNum}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            await html2pdf().set(opt).from(element).save();
            this.showNotification(this.t('notifications.pdfDownloaded'), 'success');
        } catch (error) {
            console.error('PDF generation error:', error);
            this.showNotification(this.t('notifications.pdfError'), 'error');
        }
    }

    async loadPDFLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof html2pdf !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    saveToStorage() {
        try {
            const data = this.getInvoiceData();
            localStorage.setItem('invoiceData', JSON.stringify(data));
            this.showNotification(this.t('notifications.dataSaved'), 'success');
        } catch (error) {
            console.error('Save error:', error);
            this.showNotification(this.t('notifications.saveError'), 'error');
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('invoiceData');
            if (saved) {
                const data = JSON.parse(saved);
                this.items = data.items || [{ id: Date.now(), description: '', qty: 1, price: 0 }];
                this.settings = data.settings || { taxRate: 20, discount: 0, discountType: 'percent' };
                
                // Load form values
                if (data.formData) {
                    Object.keys(data.formData).forEach(key => {
                        const input = document.getElementById(key);
                        if (input && data.formData[key]) {
                            input.value = data.formData[key];
                        }
                    });
                }
                
                // Load settings
                if (this.elements.taxRateInput) {
                    this.elements.taxRateInput.value = this.settings.taxRate;
                }
                if (this.elements.discountInput) {
                    this.elements.discountInput.value = this.settings.discount;
                }
                if (this.elements.discountTypeSelect) {
                    this.elements.discountTypeSelect.value = this.settings.discountType;
                }
            } else {
                this.items = [{ id: Date.now(), description: '3D Tarama Hizmeti - Motor Parçası', qty: 1, price: 1500.00 }];
            }
        } catch (error) {
            console.error('Load error:', error);
            this.items = [{ id: Date.now(), description: '', qty: 1, price: 0 }];
        }
    }

    autoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.saveToStorage();
        }, 2000);
    }

    getInvoiceData() {
        const formData = {};
        const formInputs = this.elements.form?.querySelectorAll('input, select, textarea');
        formInputs?.forEach(input => {
            if (input.id && input.value) {
                formData[input.id] = input.value;
            }
        });

        return {
            items: this.items,
            settings: this.settings,
            formData: formData,
            timestamp: new Date().toISOString()
        };
    }

    exportData() {
        try {
            const data = this.getInvoiceData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification(this.t('notifications.dataExported'), 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification(this.t('notifications.exportError'), 'error');
        }
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.items) {
                    this.items = data.items;
                }
                if (data.settings) {
                    this.settings = { ...this.settings, ...data.settings };
                    if (this.elements.taxRateInput) {
                        this.elements.taxRateInput.value = this.settings.taxRate;
                    }
                    if (this.elements.discountInput) {
                        this.elements.discountInput.value = this.settings.discount;
                    }
                    if (this.elements.discountTypeSelect) {
                        this.elements.discountTypeSelect.value = this.settings.discountType;
                    }
                }
                if (data.formData) {
                    Object.keys(data.formData).forEach(key => {
                        const input = document.getElementById(key);
                        if (input) {
                            input.value = data.formData[key];
                        }
                    });
                }
                
                this.renderItems();
                this.updatePreview();
                this.showNotification(this.t('notifications.dataImported'), 'success');
            } catch (error) {
                console.error('Import error:', error);
                this.showNotification(this.t('notifications.importError'), 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    }

    showNotification(message, type = 'info') {
        if (!this.elements.notification) return;
        
        this.elements.notification.textContent = message;
        this.elements.notification.className = `notification notification-${type} show`;
        
        setTimeout(() => {
            this.elements.notification.classList.remove('show');
        }, 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Load translations first, then initialize generator
    if (!window.translationManager) {
        window.translationManager = new TranslationManager();
        await window.translationManager.loadTranslations();
    }
    window.invoiceGenerator = new InvoiceGenerator();
});
