/**
 * Language File Handler
 * A web application for managing i18n JSON language files
 */

// ============================================================================
// State Management
// ============================================================================

const state = {
    languages: [],
    translations: {},
    comments: {},          // { "key.path": { "en": ["comment1", "comment2"], "es": ["comment1"] } }
    directoryHandle: null,
    fileHandles: {},
    commentFileHandles: {}, // { "en": FileHandle for en.comments.json }
    aiOnline: false,
    searchQuery: '',
    sortBy: 'name-asc',    // Current sort option
    validationResults: [],
    hasUnsavedChanges: false
};

// LM Studio Configuration
const LM_STUDIO_ENDPOINT = 'http://127.0.0.1:1234/v1/chat/completions';

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
    // Sections
    fileLoaderSection: document.getElementById('file-loader-section'),
    editorSection: document.getElementById('editor-section'),
    
    // File Loading
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    btnPickFiles: document.getElementById('btn-pick-files'),
    btnOpenFolder: document.getElementById('btn-open-folder'),
    
    // AI Status
    aiStatus: document.getElementById('ai-status'),
    
    // Toolbar
    btnAddKey: document.getElementById('btn-add-key'),
    btnAddLanguage: document.getElementById('btn-add-language'),
    btnValidateAll: document.getElementById('btn-validate-all'),
    searchInput: document.getElementById('search-input'),
    sortSelect: document.getElementById('sort-select'),
    
    // Table
    tableHeader: document.getElementById('table-header'),
    tableBody: document.getElementById('table-body'),
    statsDisplay: document.getElementById('stats-display'),
    
    // Footer
    btnLoadMore: document.getElementById('btn-load-more'),
    btnSave: document.getElementById('btn-save'),
    btnDownloadZip: document.getElementById('btn-download-zip'),
    
    // Modals
    modalAddKey: document.getElementById('modal-add-key'),
    modalAddLanguage: document.getElementById('modal-add-language'),
    modalEditValue: document.getElementById('modal-edit-value'),
    modalValidate: document.getElementById('modal-validate'),
    modalValidateSingle: document.getElementById('modal-validate-single'),
    modalValidationResults: document.getElementById('modal-validation-results'),
    
    // Modal Inputs
    newKeyPath: document.getElementById('new-key-path'),
    newKeyValues: document.getElementById('new-key-values'),
    newLanguageCode: document.getElementById('new-language-code'),
    editKeyLabel: document.getElementById('edit-key-label'),
    editLanguageLabel: document.getElementById('edit-language-label'),
    editValueInput: document.getElementById('edit-value-input'),
    editValueRemove: document.getElementById('edit-value-remove'),
    
    // Validation Modal (Bulk)
    sourceLanguagesCheckboxes: document.getElementById('source-languages-checkboxes'),
    validateLanguagesCheckboxes: document.getElementById('validate-languages-checkboxes'),
    validationResultsContent: document.getElementById('validation-results-content'),
    
    // Validation Modal (Single Key)
    validateSingleKeyLabel: document.getElementById('validate-single-key-label'),
    singleSourceLanguagesCheckboxes: document.getElementById('single-source-languages-checkboxes'),
    singleValidateLanguagesCheckboxes: document.getElementById('single-validate-languages-checkboxes'),
    
    // Edit Modal Comments
    editCommentsList: document.getElementById('edit-comments-list'),
    editNewComment: document.getElementById('edit-new-comment'),
    
    // Other
    toastContainer: document.getElementById('toast-container'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text')
};

// Current edit context
let currentEditContext = {
    key: null,
    language: null
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Add a comment for a specific key and language
 */
function addComment(key, language, comment) {
    if (!state.comments[key]) {
        state.comments[key] = {};
    }
    if (!state.comments[key][language]) {
        state.comments[key][language] = [];
    }
    
    // Add timestamp to comment
    const timestamp = new Date().toISOString();
    const fullComment = `[${timestamp}] ${comment}`;
    
    state.comments[key][language].push(fullComment);
    state.hasUnsavedChanges = true;
}

/**
 * Get comments for a specific key and language
 */
function getComments(key, language) {
    if (!state.comments[key] || !state.comments[key][language]) {
        return [];
    }
    return state.comments[key][language];
}

/**
 * Get all comments for a key (all languages)
 */
function getAllCommentsForKey(key) {
    return state.comments[key] || {};
}

/**
 * Sort languages array: EN first, then alphabetically
 */
function sortLanguages() {
    state.languages.sort((a, b) => {
        // EN always comes first
        if (a.toLowerCase() === 'en') return -1;
        if (b.toLowerCase() === 'en') return 1;
        // Then alphabetical
        return a.toLowerCase().localeCompare(b.toLowerCase());
    });
}

/**
 * Flatten nested object to dot-notation keys
 */
function flattenObject(obj, prefix = '') {
    const result = {};
    
    for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, newKey));
        } else {
            result[newKey] = value;
        }
    }
    
    return result;
}

/**
 * Reconstruct nested object from dot-notation keys
 */
function unflattenObject(obj) {
    const result = {};
    
    for (const [key, value] of Object.entries(obj)) {
        const parts = key.split('.');
        let current = result;
        
        for (let i = 0; i < parts.length - 1; i++) {
            if (!(parts[i] in current)) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        
        current[parts[parts.length - 1]] = value;
    }
    
    return result;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close">&times;</button>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());
    
    setTimeout(() => toast.remove(), duration);
}

/**
 * Show/hide loading overlay
 */
function setLoading(show, text = 'Loading...') {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.classList.toggle('hidden', !show);
}

/**
 * Open modal
 */
function openModal(modalElement) {
    modalElement.classList.remove('hidden');
}

/**
 * Close modal
 */
function closeModal(modalElement) {
    modalElement.classList.add('hidden');
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// ============================================================================
// AI / LM Studio Functions
// ============================================================================

/**
 * Check if LM Studio is available
 */
async function checkAIStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(LM_STUDIO_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'local-model',
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 1
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        state.aiOnline = response.ok;
    } catch (error) {
        state.aiOnline = false;
    }
    
    updateAIStatusUI();
}

/**
 * Update AI status indicator
 */
function updateAIStatusUI() {
    if (state.aiOnline) {
        elements.aiStatus.className = 'ai-status ai-online';
        elements.aiStatus.querySelector('.status-text').textContent = 'AI Online';
        elements.btnValidateAll.disabled = false;
    } else {
        elements.aiStatus.className = 'ai-status ai-offline';
        elements.aiStatus.querySelector('.status-text').textContent = 'AI Offline';
        elements.btnValidateAll.disabled = true;
    }
}

/**
 * Send request to LM Studio
 */
async function queryLMStudio(prompt) {
    if (!state.aiOnline) {
        throw new Error('LM Studio is not available');
    }
    
    const response = await fetch(LM_STUDIO_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'local-model',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 2000
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to get response from LM Studio');
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Parse JSON from LLM response (handles markdown code blocks)
 */
function parseJSONFromResponse(response) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
    }
    
    // Try to parse directly
    return JSON.parse(response.trim());
}

/**
 * Translate missing languages for a key
 */
async function translateKey(key) {
    const keyData = state.translations[key];
    if (!keyData) return;
    
    const existingTranslations = {};
    const missingLanguages = [];
    
    for (const lang of state.languages) {
        if (keyData[lang] !== null && keyData[lang] !== undefined) {
            existingTranslations[lang] = keyData[lang];
        } else {
            missingLanguages.push(lang);
        }
    }
    
    if (missingLanguages.length === 0) {
        showToast('No missing translations for this key', 'info');
        return;
    }
    
    if (Object.keys(existingTranslations).length === 0) {
        showToast('Need at least one existing translation as context', 'warning');
        return;
    }
    
    setLoading(true, 'Translating...');
    
    try {
        const existingList = Object.entries(existingTranslations)
            .map(([lang, value]) => `- ${lang}: "${value}"`)
            .join('\n');
        
        const prompt = `You are a translation assistant. Translate the following text to the specified languages.
Maintain the same tone, formatting (including placeholders like {0}, [b], [icon=...], etc.).

Key: ${key}

Existing translations (use as context):
${existingList}

Translate to these languages: ${missingLanguages.join(', ')}

Respond ONLY with valid JSON in this exact format:
{"translations": {"${missingLanguages[0]}": "...", ...}}`;

        const response = await queryLMStudio(prompt);
        const result = parseJSONFromResponse(response);
        
        if (result.translations) {
            for (const [lang, value] of Object.entries(result.translations)) {
                if (missingLanguages.includes(lang)) {
                    state.translations[key][lang] = value;
                    // Add comment that this was AI translated
                    addComment(key, lang, 'AI Translated');
                }
            }
            state.hasUnsavedChanges = true;
            renderTable();
            showToast(`Translated to ${Object.keys(result.translations).length} languages`, 'success');
        }
    } catch (error) {
        console.error('Translation error:', error);
        showToast('Failed to translate: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Validate translations for selected keys
 */
async function validateTranslations(sourceLanguages, validateLanguages, keys) {
    if (sourceLanguages.length === 0) {
        showToast('Please select at least one source language', 'warning');
        return [];
    }
    
    if (validateLanguages.length === 0) {
        showToast('Please select at least one language to validate', 'warning');
        return [];
    }
    
    setLoading(true, 'Validating translations...');
    state.validationResults = [];
    
    try {
        // Process in batches to avoid overwhelming the LLM
        const batchSize = 5;
        for (let i = 0; i < keys.length; i += batchSize) {
            const batch = keys.slice(i, i + batchSize);
            
            for (const key of batch) {
                const keyData = state.translations[key];
                if (!keyData) continue;
                
                // Get source translations
                const sourceTranslations = {};
                let hasSource = false;
                for (const lang of sourceLanguages) {
                    if (keyData[lang] !== null && keyData[lang] !== undefined) {
                        sourceTranslations[lang] = keyData[lang];
                        hasSource = true;
                    }
                }
                
                if (!hasSource) continue;
                
                // Get translations to validate
                const toValidate = {};
                for (const lang of validateLanguages) {
                    if (keyData[lang] !== null && keyData[lang] !== undefined) {
                        toValidate[lang] = keyData[lang];
                    }
                }
                
                if (Object.keys(toValidate).length === 0) continue;
                
                const sourceList = Object.entries(sourceTranslations)
                    .map(([lang, value]) => `- ${lang}: "${value}"`)
                    .join('\n');
                
                const validateList = Object.entries(toValidate)
                    .map(([lang, value]) => `- ${lang}: "${value}"`)
                    .join('\n');
                
                const prompt = `You are a translation validator. Check if the translations are correct based on the source translations.

Key: ${key}
Source translations (these are correct):
${sourceList}

Translations to validate:
${validateList}

For each language, respond with:
- "correct": true/false
- "suggestion": only if incorrect, provide the correct translation

Respond ONLY with valid JSON:
{
  "validations": {
    "${Object.keys(toValidate)[0]}": {"correct": true/false, "suggestion": "...if incorrect..."}
  }
}`;

                try {
                    const response = await queryLMStudio(prompt);
                    const result = parseJSONFromResponse(response);
                    
                    if (result.validations) {
                        // Add comments for incorrect translations with suggestions
                        for (const [lang, validation] of Object.entries(result.validations)) {
                            if (!validation.correct && validation.suggestion) {
                                addComment(key, lang, `AI Validation: Incorrect. Suggested: "${validation.suggestion}"`);
                            }
                        }
                        
                        state.validationResults.push({
                            key,
                            validations: result.validations
                        });
                    }
                } catch (error) {
                    console.error(`Validation error for key ${key}:`, error);
                }
            }
            
            // Update progress
            elements.loadingText.textContent = `Validating... ${Math.min(i + batchSize, keys.length)}/${keys.length}`;
        }
        
        return state.validationResults;
    } finally {
        setLoading(false);
    }
}

/**
 * Open the single key validation modal
 */
function openSingleKeyValidationModal(key) {
    const keyData = state.translations[key];
    if (!keyData) return;
    
    // Store the key being validated
    currentEditContext.key = key;
    
    // Set the key label
    elements.validateSingleKeyLabel.textContent = `Key: ${key}`;
    
    // Clear and populate checkboxes
    elements.singleSourceLanguagesCheckboxes.innerHTML = '';
    elements.singleValidateLanguagesCheckboxes.innerHTML = '';
    
    for (const lang of state.languages) {
        const hasValue = keyData[lang] !== null && keyData[lang] !== undefined;
        
        // Source language checkbox (only show languages that have values)
        if (hasValue) {
            const sourceLabel = document.createElement('label');
            sourceLabel.className = 'checkbox-label';
            sourceLabel.innerHTML = `
                <input type="checkbox" name="single-source-lang" value="${lang}" ${lang === 'en' ? 'checked' : ''}>
                ${lang.toUpperCase()}
            `;
            elements.singleSourceLanguagesCheckboxes.appendChild(sourceLabel);
        }
        
        // Validate language checkbox (only show languages that have values)
        if (hasValue) {
            const validateLabel = document.createElement('label');
            validateLabel.className = 'checkbox-label';
            validateLabel.innerHTML = `
                <input type="checkbox" name="single-validate-lang" value="${lang}" ${lang !== 'en' ? 'checked' : ''}>
                ${lang.toUpperCase()}
            `;
            elements.singleValidateLanguagesCheckboxes.appendChild(validateLabel);
        }
    }
    
    openModal(elements.modalValidateSingle);
}

/**
 * Execute single key validation
 */
async function executeSingleKeyValidation() {
    const key = currentEditContext.key;
    const keyData = state.translations[key];
    if (!keyData) return;
    
    const sourceLanguages = Array.from(document.querySelectorAll('input[name="single-source-lang"]:checked'))
        .map(cb => cb.value);
    const validateLanguages = Array.from(document.querySelectorAll('input[name="single-validate-lang"]:checked'))
        .map(cb => cb.value);
    
    if (sourceLanguages.length === 0) {
        showToast('Please select at least one source language', 'warning');
        return;
    }
    
    if (validateLanguages.length === 0) {
        showToast('Please select at least one language to validate', 'warning');
        return;
    }
    
    // Filter out source languages from validation targets
    const filteredValidateLanguages = validateLanguages.filter(l => !sourceLanguages.includes(l));
    
    if (filteredValidateLanguages.length === 0) {
        showToast('Please select different languages for source and validation', 'warning');
        return;
    }
    
    closeModal(elements.modalValidateSingle);
    setLoading(true, 'Validating...');
    
    try {
        const sourceList = sourceLanguages
            .map(lang => `- ${lang}: "${keyData[lang]}"`)
            .join('\n');
        
        const validateList = filteredValidateLanguages
            .map(lang => `- ${lang}: "${keyData[lang]}"`)
            .join('\n');
        
        const prompt = `You are a translation validator. Check if the translations are correct based on the source translations.

Key: ${key}
Source translations (these are correct):
${sourceList}

Translations to validate:
${validateList}

For each language, respond with:
- "correct": true/false
- "suggestion": only if incorrect, provide the correct translation

Respond ONLY with valid JSON:
{
  "validations": {
    "${filteredValidateLanguages[0]}": {"correct": true/false, "suggestion": "...if incorrect..."}
  }
}`;

        const response = await queryLMStudio(prompt);
        const result = parseJSONFromResponse(response);
        
        if (result.validations) {
            // Add comments for incorrect translations with suggestions
            for (const [lang, validation] of Object.entries(result.validations)) {
                if (!validation.correct && validation.suggestion) {
                    addComment(key, lang, `AI Validation: Incorrect. Suggested: "${validation.suggestion}"`);
                }
            }
            
            // Store result and show modal
            state.validationResults = [{
                key,
                validations: result.validations
            }];
            
            renderValidationResults();
            openModal(elements.modalValidationResults);
        }
    } catch (error) {
        console.error('Validation error:', error);
        showToast('Failed to validate: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// ============================================================================
// File System Functions
// ============================================================================

/**
 * Parse language files and merge into state
 */
function parseAndMergeFiles(files) {
    // Separate comment files from translation files
    const translationFiles = [];
    const commentFiles = [];
    
    for (const file of files) {
        if (file.name.endsWith('.comments.json')) {
            commentFiles.push(file);
        } else if (file.name.endsWith('.json')) {
            translationFiles.push(file);
        }
    }
    
    // Process translation files first
    for (const { name, content, handle } of translationFiles) {
        const langCode = name.replace('.json', '');
        
        try {
            const data = JSON.parse(content);
            const flattened = flattenObject(data);
            
            if (!state.languages.includes(langCode)) {
                state.languages.push(langCode);
            }
            
            if (handle) {
                state.fileHandles[langCode] = handle;
            }
            
            // Merge translations
            for (const [key, value] of Object.entries(flattened)) {
                if (!state.translations[key]) {
                    state.translations[key] = {};
                    for (const lang of state.languages) {
                        state.translations[key][lang] = null;
                    }
                }
                state.translations[key][langCode] = value;
            }
            
            // Ensure all keys have entries for all languages
            for (const key of Object.keys(state.translations)) {
                if (!(langCode in state.translations[key])) {
                    state.translations[key][langCode] = null;
                }
            }
        } catch (error) {
            console.error(`Error parsing ${name}:`, error);
            showToast(`Error parsing ${name}: ${error.message}`, 'error');
        }
    }
    
    // Ensure all translations have all languages
    for (const key of Object.keys(state.translations)) {
        for (const lang of state.languages) {
            if (!(lang in state.translations[key])) {
                state.translations[key][lang] = null;
            }
        }
    }
    
    // Sort languages: EN first, then alphabetically
    sortLanguages();
    
    // Process comment files
    for (const { name, content, handle } of commentFiles) {
        const langCode = name.replace('.comments.json', '');
        
        try {
            const data = JSON.parse(content);
            
            if (handle) {
                state.commentFileHandles[langCode] = handle;
            }
            
            // Merge comments - data structure: { "key.path": ["comment1", "comment2"] }
            for (const [key, comments] of Object.entries(data)) {
                if (!state.comments[key]) {
                    state.comments[key] = {};
                }
                if (Array.isArray(comments)) {
                    state.comments[key][langCode] = comments;
                }
            }
        } catch (error) {
            console.error(`Error parsing ${name}:`, error);
            showToast(`Error parsing ${name}: ${error.message}`, 'error');
        }
    }
}

/**
 * Handle file drop
 */
async function handleFileDrop(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('drag-over');
    
    const files = [];
    const items = e.dataTransfer.items;
    
    for (const item of items) {
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file.name.endsWith('.json')) {
                const content = await file.text();
                files.push({ name: file.name, content, handle: null });
            }
        }
    }
    
    if (files.length > 0) {
        parseAndMergeFiles(files);
        showEditor();
        showToast(`Loaded ${files.length} language file(s)`, 'success');
    }
}

/**
 * Handle file picker
 */
async function handleFilePicker() {
    elements.fileInput.click();
}

/**
 * Handle file input change
 */
async function handleFileInputChange(e) {
    const files = [];
    
    for (const file of e.target.files) {
        if (file.name.endsWith('.json')) {
            const content = await file.text();
            files.push({ name: file.name, content, handle: null });
        }
    }
    
    if (files.length > 0) {
        parseAndMergeFiles(files);
        showEditor();
        showToast(`Loaded ${files.length} language file(s)`, 'success');
    }
    
    // Reset input
    e.target.value = '';
}

/**
 * Handle folder picker (File System Access API)
 */
async function handleFolderPicker() {
    if (!('showDirectoryPicker' in window)) {
        showToast('Folder picker not supported in this browser. Use Chrome or Edge.', 'warning');
        return;
    }
    
    try {
        const dirHandle = await window.showDirectoryPicker();
        state.directoryHandle = dirHandle;
        
        const files = [];
        
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                const file = await entry.getFile();
                const content = await file.text();
                files.push({ name: entry.name, content, handle: entry });
            }
        }
        
        if (files.length > 0) {
            parseAndMergeFiles(files);
            showEditor();
            elements.btnSave.disabled = false;
            showToast(`Loaded ${files.length} language file(s) from folder`, 'success');
        } else {
            showToast('No JSON files found in the selected folder', 'warning');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Folder picker error:', error);
            showToast('Error opening folder: ' + error.message, 'error');
        }
    }
}

/**
 * Save files to folder (File System Access API)
 */
async function saveToFolder() {
    if (!state.directoryHandle) {
        showToast('No folder opened. Use "Open Folder" first.', 'warning');
        return;
    }
    
    setLoading(true, 'Saving files...');
    
    try {
        for (const lang of state.languages) {
            // Build the data for this language
            const langData = {};
            for (const [key, values] of Object.entries(state.translations)) {
                if (values[lang] !== null && values[lang] !== undefined) {
                    langData[key] = values[lang];
                }
            }
            
            // Reconstruct nested structure
            const nested = unflattenObject(langData);
            const content = JSON.stringify(nested, null, '\t');
            
            // Get or create file handle
            let fileHandle = state.fileHandles[lang];
            if (!fileHandle) {
                fileHandle = await state.directoryHandle.getFileHandle(`${lang}.json`, { create: true });
                state.fileHandles[lang] = fileHandle;
            }
            
            // Write file
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
        }
        
        // Save comment files
        await saveCommentFiles();
        
        state.hasUnsavedChanges = false;
        showToast('All files saved successfully', 'success');
    } catch (error) {
        console.error('Save error:', error);
        showToast('Error saving files: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Build comment data for a specific language
 */
function buildCommentDataForLanguage(lang) {
    const commentData = {};
    for (const [key, langComments] of Object.entries(state.comments)) {
        if (langComments[lang] && langComments[lang].length > 0) {
            commentData[key] = langComments[lang];
        }
    }
    return commentData;
}

/**
 * Save comment files to folder
 */
async function saveCommentFiles() {
    if (!state.directoryHandle) return;
    
    for (const lang of state.languages) {
        const commentData = buildCommentDataForLanguage(lang);
        
        // Only save if there are comments
        if (Object.keys(commentData).length === 0) continue;
        
        const content = JSON.stringify(commentData, null, '\t');
        
        // Get or create comment file handle
        let fileHandle = state.commentFileHandles[lang];
        if (!fileHandle) {
            fileHandle = await state.directoryHandle.getFileHandle(`${lang}.comments.json`, { create: true });
            state.commentFileHandles[lang] = fileHandle;
        }
        
        // Write file
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    }
}

/**
 * Download all files as ZIP
 */
async function downloadZip() {
    setLoading(true, 'Creating ZIP file...');
    
    try {
        const zip = new JSZip();
        
        for (const lang of state.languages) {
            // Build the data for this language
            const langData = {};
            for (const [key, values] of Object.entries(state.translations)) {
                if (values[lang] !== null && values[lang] !== undefined) {
                    langData[key] = values[lang];
                }
            }
            
            // Reconstruct nested structure
            const nested = unflattenObject(langData);
            const content = JSON.stringify(nested, null, '\t');
            
            zip.file(`${lang}.json`, content);
            
            // Add comment file if there are comments for this language
            const commentData = buildCommentDataForLanguage(lang);
            if (Object.keys(commentData).length > 0) {
                zip.file(`${lang}.comments.json`, JSON.stringify(commentData, null, '\t'));
            }
        }
        
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'language-files.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('ZIP file downloaded', 'success');
    } catch (error) {
        console.error('ZIP error:', error);
        showToast('Error creating ZIP: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// ============================================================================
// UI Rendering Functions
// ============================================================================

/**
 * Show editor section
 */
function showEditor() {
    elements.fileLoaderSection.classList.add('hidden');
    elements.editorSection.classList.remove('hidden');
    renderTable();
    updateStats();
}

/**
 * Update statistics display
 */
function updateStats() {
    const keyCount = Object.keys(state.translations).length;
    const langCount = state.languages.length;
    elements.statsDisplay.textContent = `${keyCount} keys, ${langCount} languages`;
}

/**
 * Render table header
 */
function renderTableHeader() {
    // Clear existing language columns from both headers
    const existingLangCols = elements.tableHeader.querySelectorAll('.col-lang');
    existingLangCols.forEach(col => col.remove());
    
    const stickyHeader = document.getElementById('sticky-table-header');
    const existingStickyLangCols = stickyHeader.querySelectorAll('.header-lang');
    existingStickyLangCols.forEach(col => col.remove());
    
    // Add language columns before actions column
    const actionsCol = elements.tableHeader.querySelector('.col-actions');
    const stickyActionsCol = stickyHeader.querySelector('.header-actions');
    
    for (const lang of state.languages) {
        // Count non-null values for this language
        const count = Object.values(state.translations).filter(v => v[lang] !== null && v[lang] !== undefined).length;
        const total = Object.keys(state.translations).length;
        
        // Add to actual table header (hidden but keeps structure)
        const th = document.createElement('th');
        th.className = 'col-lang';
        th.innerHTML = `
            <div class="lang-header">
                <span class="lang-code">${escapeHtml(lang)}</span>
                <span class="lang-count">${count}/${total}</span>
            </div>
        `;
        elements.tableHeader.insertBefore(th, actionsCol);
        
        // Add to sticky header
        const stickyCell = document.createElement('div');
        stickyCell.className = 'header-cell header-lang';
        stickyCell.innerHTML = `
            <div class="lang-header">
                <span class="lang-code">${escapeHtml(lang)}</span>
                <span class="lang-count">${count}/${total}</span>
            </div>
        `;
        stickyHeader.insertBefore(stickyCell, stickyActionsCol);
    }
}

/**
 * Get the number of missing translations for a key
 */
function getMissingCount(key) {
    let count = 0;
    for (const lang of state.languages) {
        if (state.translations[key][lang] === null || state.translations[key][lang] === undefined) {
            count++;
        }
    }
    return count;
}

/**
 * Get the total number of comments for a key (across all languages)
 */
function getTotalCommentCount(key) {
    let count = 0;
    const keyComments = state.comments[key];
    if (keyComments) {
        for (const lang of Object.keys(keyComments)) {
            count += keyComments[lang].length;
        }
    }
    return count;
}

/**
 * Sort keys based on current sort option
 */
function sortKeys(keys) {
    const [sortField, sortDirection] = state.sortBy.split('-');
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    return keys.sort((a, b) => {
        switch (sortField) {
            case 'name':
                return multiplier * a.localeCompare(b);
            case 'missing':
                const missingA = getMissingCount(a);
                const missingB = getMissingCount(b);
                if (missingA !== missingB) {
                    return multiplier * (missingA - missingB);
                }
                return a.localeCompare(b); // Secondary sort by name
            case 'comments':
                const commentsA = getTotalCommentCount(a);
                const commentsB = getTotalCommentCount(b);
                if (commentsA !== commentsB) {
                    return multiplier * (commentsA - commentsB);
                }
                return a.localeCompare(b); // Secondary sort by name
            default:
                return a.localeCompare(b);
        }
    });
}

/**
 * Render table body
 */
function renderTable() {
    renderTableHeader();
    elements.tableBody.innerHTML = '';
    
    const searchQuery = state.searchQuery.toLowerCase();
    let keys = Object.keys(state.translations);
    
    // Filter by search first
    if (searchQuery) {
        keys = keys.filter(key => key.toLowerCase().includes(searchQuery));
    }
    
    // Then sort
    const sortedKeys = sortKeys(keys);
    
    for (const key of sortedKeys) {
        
        const row = document.createElement('tr');
        row.dataset.key = key;
        
        // Key cell
        const keyCell = document.createElement('td');
        keyCell.className = 'key-cell';
        keyCell.textContent = key;
        row.appendChild(keyCell);
        
        // Value cells for each language
        for (const lang of state.languages) {
            const valueCell = document.createElement('td');
            valueCell.className = 'value-cell';
            
            const value = state.translations[key][lang];
            const comments = getComments(key, lang);
            const hasComments = comments.length > 0;
            
            // Build comment indicator with data attribute for tooltip
            let commentIndicatorHtml = '';
            if (hasComments) {
                const lastComment = comments[comments.length - 1];
                // Extract just the text part (remove timestamp if present)
                const lastCommentText = lastComment.replace(/^\[[^\]]+\]\s*/, '');
                const truncatedComment = lastCommentText.length > 150 
                    ? lastCommentText.substring(0, 150) + '...' 
                    : lastCommentText;
                commentIndicatorHtml = `
                    <span class="comment-indicator" data-tooltip="${escapeHtml(truncatedComment)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        ${comments.length}
                    </span>`;
            }
            
            if (value === null || value === undefined) {
                valueCell.innerHTML = `
                    <div class="value-cell-wrapper">
                        <span class="value-content value-missing" data-key="${escapeHtml(key)}" data-lang="${escapeHtml(lang)}">Missing</span>
                        ${commentIndicatorHtml}
                    </div>`;
            } else {
                const displayValue = String(value).length > 100 
                    ? String(value).substring(0, 100) + '...' 
                    : String(value);
                valueCell.innerHTML = `
                    <div class="value-cell-wrapper">
                        <span class="value-content" data-key="${escapeHtml(key)}" data-lang="${escapeHtml(lang)}">${escapeHtml(displayValue)}</span>
                        ${commentIndicatorHtml}
                    </div>`;
            }
            
            row.appendChild(valueCell);
        }
        
        // Actions cell
        const actionsCell = document.createElement('td');
        actionsCell.className = 'actions-cell';
        
        // Check if there are missing translations
        const hasMissing = state.languages.some(lang => 
            state.translations[key][lang] === null || state.translations[key][lang] === undefined
        );
        
        actionsCell.innerHTML = `
            <button class="btn btn-icon btn-sm btn-translate" data-key="${escapeHtml(key)}" title="AI Translate Missing" ${!state.aiOnline || !hasMissing ? 'disabled' : ''}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
            </button>
            <button class="btn btn-icon btn-sm btn-validate-key" data-key="${escapeHtml(key)}" title="AI Validate Translations" ${!state.aiOnline ? 'disabled' : ''}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
            </button>
            <button class="btn btn-icon btn-sm btn-delete" data-key="${escapeHtml(key)}" title="Delete Key">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        `;
        
        row.appendChild(actionsCell);
        elements.tableBody.appendChild(row);
    }
    
    updateStats();
}

/**
 * Render add key modal language inputs
 */
function renderAddKeyModal() {
    elements.newKeyValues.innerHTML = '';
    
    for (const lang of state.languages) {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label for="new-key-${lang}">${lang.toUpperCase()}</label>
            <input type="text" id="new-key-${lang}" data-lang="${lang}" placeholder="Value for ${lang}">
        `;
        elements.newKeyValues.appendChild(div);
    }
}

/**
 * Render validation modal checkboxes
 */
function renderValidationModal() {
    elements.sourceLanguagesCheckboxes.innerHTML = '';
    elements.validateLanguagesCheckboxes.innerHTML = '';
    
    for (const lang of state.languages) {
        // Source language checkbox
        const sourceLabel = document.createElement('label');
        sourceLabel.className = 'checkbox-label';
        sourceLabel.innerHTML = `
            <input type="checkbox" name="source-lang" value="${lang}" ${lang === 'en' ? 'checked' : ''}>
            ${lang.toUpperCase()}
        `;
        elements.sourceLanguagesCheckboxes.appendChild(sourceLabel);
        
        // Validate language checkbox
        const validateLabel = document.createElement('label');
        validateLabel.className = 'checkbox-label';
        validateLabel.innerHTML = `
            <input type="checkbox" name="validate-lang" value="${lang}" ${lang !== 'en' ? 'checked' : ''}>
            ${lang.toUpperCase()}
        `;
        elements.validateLanguagesCheckboxes.appendChild(validateLabel);
    }
}

/**
 * Render validation results
 */
function renderValidationResults() {
    elements.validationResultsContent.innerHTML = '';
    
    if (state.validationResults.length === 0) {
        elements.validationResultsContent.innerHTML = '<p>No validation results to display.</p>';
        return;
    }
    
    // Filter to show only invalid results first
    const invalidResults = state.validationResults.filter(r => 
        Object.values(r.validations).some(v => !v.correct)
    );
    
    const validResults = state.validationResults.filter(r => 
        Object.values(r.validations).every(v => v.correct)
    );
    
    // Show summary
    const summary = document.createElement('div');
    summary.className = 'validation-summary';
    summary.innerHTML = `
        <p><strong>Summary:</strong> ${invalidResults.length} keys with issues, ${validResults.length} keys correct</p>
    `;
    elements.validationResultsContent.appendChild(summary);
    
    // Show invalid results
    for (const result of invalidResults) {
        const item = document.createElement('div');
        item.className = 'validation-item invalid';
        
        let langsHtml = '';
        for (const [lang, validation] of Object.entries(result.validations)) {
            if (!validation.correct) {
                langsHtml += `
                    <div class="validation-lang">
                        <span class="validation-lang-code">${lang}</span>
                        <span class="validation-current">Current: "${escapeHtml(state.translations[result.key][lang])}"</span>
                        ${validation.suggestion ? `<span class="validation-suggestion">Suggested: "${escapeHtml(validation.suggestion)}"</span>` : ''}
                        <span class="validation-status invalid">Incorrect</span>
                    </div>
                `;
            }
        }
        
        item.innerHTML = `
            <div class="validation-key">${escapeHtml(result.key)}</div>
            ${langsHtml}
        `;
        
        elements.validationResultsContent.appendChild(item);
    }
    
    // Show valid results (collapsed)
    if (validResults.length > 0) {
        const validSection = document.createElement('details');
        validSection.innerHTML = `
            <summary style="cursor: pointer; margin-top: 16px; color: var(--color-success);">
                ${validResults.length} keys validated correctly
            </summary>
            <div style="margin-top: 8px;">
                ${validResults.map(r => `<div class="validation-key" style="padding: 4px 0;">${escapeHtml(r.key)}</div>`).join('')}
            </div>
        `;
        elements.validationResultsContent.appendChild(validSection);
    }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Add new key
 */
function addKey() {
    const keyPath = elements.newKeyPath.value.trim();
    
    if (!keyPath) {
        showToast('Please enter a key path', 'warning');
        return;
    }
    
    if (state.translations[keyPath]) {
        showToast('This key already exists', 'warning');
        return;
    }
    
    // Get values for each language
    state.translations[keyPath] = {};
    for (const lang of state.languages) {
        const input = document.querySelector(`#new-key-${lang}`);
        const value = input ? input.value.trim() : '';
        state.translations[keyPath][lang] = value || null;
    }
    
    state.hasUnsavedChanges = true;
    closeModal(elements.modalAddKey);
    renderTable();
    showToast('Key added successfully', 'success');
    
    // Reset form
    elements.newKeyPath.value = '';
}

/**
 * Delete key
 */
function deleteKey(key) {
    if (!confirm(`Are you sure you want to delete the key "${key}" from all languages?`)) {
        return;
    }
    
    delete state.translations[key];
    state.hasUnsavedChanges = true;
    renderTable();
    showToast('Key deleted', 'success');
}

/**
 * Add new language
 */
function addLanguage() {
    const langCode = elements.newLanguageCode.value.trim().toLowerCase();
    
    if (!langCode) {
        showToast('Please enter a language code', 'warning');
        return;
    }
    
    if (state.languages.includes(langCode)) {
        showToast('This language already exists', 'warning');
        return;
    }
    
    // Add language
    state.languages.push(langCode);
    
    // Sort languages: EN first, then alphabetically
    sortLanguages();
    
    // Add null values for all existing keys
    for (const key of Object.keys(state.translations)) {
        state.translations[key][langCode] = null;
    }
    
    state.hasUnsavedChanges = true;
    closeModal(elements.modalAddLanguage);
    renderTable();
    showToast(`Language "${langCode}" added`, 'success');
    
    // Reset form
    elements.newLanguageCode.value = '';
}

/**
 * Open edit value modal
 */
function openEditModal(key, lang) {
    currentEditContext = { key, lang };
    
    elements.editKeyLabel.textContent = `Key: ${key}`;
    elements.editLanguageLabel.textContent = lang.toUpperCase();
    
    const value = state.translations[key][lang];
    elements.editValueInput.value = value !== null && value !== undefined ? value : '';
    elements.editValueRemove.checked = value === null || value === undefined;
    
    // Render comments
    renderEditComments(key, lang);
    elements.editNewComment.value = '';
    
    openModal(elements.modalEditValue);
    elements.editValueInput.focus();
}

/**
 * Render comments in the edit modal
 */
function renderEditComments(key, lang) {
    const comments = getComments(key, lang);
    elements.editCommentsList.innerHTML = '';
    
    for (const comment of comments) {
        const item = document.createElement('div');
        item.className = 'comment-item';
        
        // Parse timestamp from comment if present
        const timestampMatch = comment.match(/^\[([^\]]+)\]\s*/);
        if (timestampMatch) {
            const timestamp = timestampMatch[1];
            const text = comment.replace(timestampMatch[0], '');
            item.innerHTML = `
                <span class="comment-timestamp">${escapeHtml(timestamp)}</span>
                <span class="comment-text">${escapeHtml(text)}</span>
            `;
        } else {
            item.innerHTML = `<span class="comment-text">${escapeHtml(comment)}</span>`;
        }
        
        elements.editCommentsList.appendChild(item);
    }
}

/**
 * Add a new comment from the edit modal
 */
function addCommentFromModal() {
    const { key, lang } = currentEditContext;
    const commentText = elements.editNewComment.value.trim();
    
    if (!commentText) {
        showToast('Please enter a comment', 'warning');
        return;
    }
    
    addComment(key, lang, commentText);
    renderEditComments(key, lang);
    elements.editNewComment.value = '';
    renderTable(); // Update comment indicator
    showToast('Comment added', 'success');
}

/**
 * Save edited value
 */
function saveEditedValue() {
    const { key, lang } = currentEditContext;
    
    if (elements.editValueRemove.checked) {
        state.translations[key][lang] = null;
    } else {
        state.translations[key][lang] = elements.editValueInput.value;
    }
    
    state.hasUnsavedChanges = true;
    closeModal(elements.modalEditValue);
    renderTable();
    showToast('Value updated', 'success');
}

/**
 * Apply all validation suggestions
 */
function applyAllSuggestions() {
    let appliedCount = 0;
    
    for (const result of state.validationResults) {
        for (const [lang, validation] of Object.entries(result.validations)) {
            if (!validation.correct && validation.suggestion) {
                state.translations[result.key][lang] = validation.suggestion;
                appliedCount++;
            }
        }
    }
    
    if (appliedCount > 0) {
        state.hasUnsavedChanges = true;
        renderTable();
        showToast(`Applied ${appliedCount} suggestions`, 'success');
    } else {
        showToast('No suggestions to apply', 'info');
    }
    
    closeModal(elements.modalValidationResults);
}

// ============================================================================
// Event Listeners
// ============================================================================

function initEventListeners() {
    // Drag and drop
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('drag-over');
    });
    
    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('drag-over');
    });
    
    elements.dropZone.addEventListener('drop', handleFileDrop);
    elements.dropZone.addEventListener('click', handleFilePicker);
    
    // File buttons
    elements.btnPickFiles.addEventListener('click', handleFilePicker);
    elements.btnOpenFolder.addEventListener('click', handleFolderPicker);
    elements.fileInput.addEventListener('change', handleFileInputChange);
    
    // Toolbar buttons
    elements.btnAddKey.addEventListener('click', () => {
        renderAddKeyModal();
        openModal(elements.modalAddKey);
    });
    
    elements.btnAddLanguage.addEventListener('click', () => {
        openModal(elements.modalAddLanguage);
    });
    
    elements.btnValidateAll.addEventListener('click', () => {
        renderValidationModal();
        openModal(elements.modalValidate);
    });
    
    // Search
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderTable();
    });
    
    // Sort
    elements.sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderTable();
    });
    
    // Footer buttons
    elements.btnLoadMore.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    elements.btnSave.addEventListener('click', saveToFolder);
    elements.btnDownloadZip.addEventListener('click', downloadZip);
    
    // Modal confirm buttons
    document.getElementById('btn-confirm-add-key').addEventListener('click', addKey);
    document.getElementById('btn-confirm-add-language').addEventListener('click', addLanguage);
    document.getElementById('btn-confirm-edit-value').addEventListener('click', saveEditedValue);
    document.getElementById('btn-apply-suggestions').addEventListener('click', applyAllSuggestions);
    document.getElementById('btn-add-comment').addEventListener('click', addCommentFromModal);
    
    // Allow Enter key to add comment
    elements.editNewComment.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCommentFromModal();
        }
    });
    
    // Single key validation button
    document.getElementById('btn-start-single-validation').addEventListener('click', executeSingleKeyValidation);
    
    // Start validation button (bulk)
    document.getElementById('btn-start-validation').addEventListener('click', async () => {
        const sourceLanguages = Array.from(document.querySelectorAll('input[name="source-lang"]:checked'))
            .map(cb => cb.value);
        const validateLanguages = Array.from(document.querySelectorAll('input[name="validate-lang"]:checked'))
            .map(cb => cb.value);
        const scope = document.querySelector('input[name="validate-scope"]:checked').value;
        
        let keys = Object.keys(state.translations);
        if (scope === 'filtered' && state.searchQuery) {
            keys = keys.filter(k => k.toLowerCase().includes(state.searchQuery.toLowerCase()));
        }
        
        closeModal(elements.modalValidate);
        
        await validateTranslations(sourceLanguages, validateLanguages, keys);
        
        if (state.validationResults.length > 0) {
            renderValidationResults();
            openModal(elements.modalValidationResults);
        } else {
            showToast('No translations to validate', 'info');
        }
    });
    
    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-overlay');
            if (modal) closeModal(modal);
        });
    });
    
    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(overlay);
            }
        });
    });
    
    // Table click handlers (delegation)
    elements.tableBody.addEventListener('click', (e) => {
        const target = e.target.closest('[data-key]');
        if (!target) return;
        
        const key = target.dataset.key;
        const lang = target.dataset.lang;
        
        // Value cell click
        if (target.classList.contains('value-content')) {
            openEditModal(key, lang);
            return;
        }
        
        // Translate button
        if (target.classList.contains('btn-translate')) {
            translateKey(key);
            return;
        }
        
        // Delete button
        if (target.classList.contains('btn-delete')) {
            deleteKey(key);
            return;
        }
        
        // Validate single key button
        if (target.classList.contains('btn-validate-key')) {
            openSingleKeyValidationModal(key);
            return;
        }
    });
    
    // Comment tooltip handlers (delegation)
    const commentTooltip = document.getElementById('comment-tooltip');
    const commentTooltipText = document.getElementById('comment-tooltip-text');
    
    document.addEventListener('mouseover', (e) => {
        const indicator = e.target.closest('.comment-indicator');
        if (indicator && indicator.dataset.tooltip) {
            commentTooltipText.textContent = indicator.dataset.tooltip;
            
            const rect = indicator.getBoundingClientRect();
            commentTooltip.style.left = rect.left + 'px';
            commentTooltip.style.top = (rect.top - 8) + 'px';
            commentTooltip.style.transform = 'translateY(-100%)';
            commentTooltip.classList.add('visible');
        }
    });
    
    document.addEventListener('mouseout', (e) => {
        const indicator = e.target.closest('.comment-indicator');
        if (indicator) {
            commentTooltip.classList.remove('visible');
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
                closeModal(modal);
            });
        }
        
        // Ctrl+S to save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (state.directoryHandle) {
                saveToFolder();
            } else {
                downloadZip();
            }
        }
    });
    
    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (state.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    
    // Sticky header shadow on scroll
    let ticking = false;
    const stickyHeader = document.getElementById('sticky-header');
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const currentScrollY = window.scrollY;
                
                if (stickyHeader) {
                    // Add shadow when scrolled
                    if (currentScrollY > 10) {
                        stickyHeader.classList.add('sticky-shadow');
                    } else {
                        stickyHeader.classList.remove('sticky-shadow');
                    }
                }
                
                ticking = false;
            });
            ticking = true;
        }
    });
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    initEventListeners();
    await checkAIStatus();
    
    // Periodically check AI status
    setInterval(checkAIStatus, 30000);
}

// Start the app
init();
