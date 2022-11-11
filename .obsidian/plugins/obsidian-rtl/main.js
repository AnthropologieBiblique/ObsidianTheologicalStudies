'use strict';

var obsidian = require('obsidian');

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

class Settings {
    constructor() {
        this.fileDirections = {};
        this.defaultDirection = 'ltr';
        this.rememberPerFile = true;
        this.setNoteTitleDirection = true;
        this.setYamlDirection = false;
    }
    toJson() {
        return JSON.stringify(this);
    }
    fromJson(content) {
        var obj = JSON.parse(content);
        this.fileDirections = obj['fileDirections'];
        this.defaultDirection = obj['defaultDirection'];
        this.rememberPerFile = obj['rememberPerFile'];
        this.setNoteTitleDirection = obj['setNoteTitleDirection'];
    }
}
class RtlPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.settings = new Settings();
        this.SETTINGS_PATH = '.obsidian/rtl.json';
        // This stores the value in CodeMirror's autoCloseBrackets option before overriding it, so it can be restored when
        // we're back to LTR
        this.autoCloseBracketsValue = false;
        this.initialized = false;
    }
    onload() {
        this.addCommand({
            id: 'switch-text-direction',
            name: 'Switch Text Direction (LTR<>RTL)',
            callback: () => { this.toggleDocumentDirection(); }
        });
        this.addSettingTab(new RtlSettingsTab(this.app, this));
        this.loadSettings();
        this.app.workspace.on('active-leaf-change', (leaf) => __awaiter(this, void 0, void 0, function* () {
            if (leaf.view instanceof obsidian.MarkdownView) {
                const file = leaf.view.file;
                yield this.onFileOpen(file);
            }
        }));
        this.app.workspace.on('file-open', (file) => __awaiter(this, void 0, void 0, function* () {
            yield this.onFileOpen(file);
        }));
        this.registerEvent(this.app.vault.on('delete', (file) => {
            if (file && file.path && file.path in this.settings.fileDirections) {
                delete this.settings.fileDirections[file.path];
                this.saveSettings();
            }
        }));
        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
            if (file && file.path && oldPath in this.settings.fileDirections) {
                this.settings.fileDirections[file.path] = this.settings.fileDirections[oldPath];
                delete this.settings.fileDirections[oldPath];
                this.saveSettings();
            }
        }));
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            this.initialized = true;
        });
    }
    onunload() {
        console.log('unloading RTL plugin');
    }
    onFileOpen(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.initialized)
                yield this.initialize();
            if (file && file.path) {
                this.syncDefaultDirection();
                this.currentFile = file;
                this.adjustDirectionToCurrentFile();
            }
        });
    }
    adjustDirectionToCurrentFile() {
        if (this.currentFile && this.currentFile.path) {
            let requiredDirection = null;
            const frontMatterDirection = this.getFrontMatterDirection(this.currentFile);
            if (frontMatterDirection) {
                if (frontMatterDirection == 'rtl' || frontMatterDirection == 'ltr')
                    requiredDirection = frontMatterDirection;
                else
                    console.log('Front matter direction in file', this.currentFile.path, 'is unknown:', frontMatterDirection);
            }
            else if (this.settings.rememberPerFile && this.currentFile.path in this.settings.fileDirections) {
                // If the user wants to remember the direction per file, and we have a direction set for this file -- use it
                requiredDirection = this.settings.fileDirections[this.currentFile.path];
            }
            else {
                // Use the default direction
                requiredDirection = this.settings.defaultDirection;
            }
            this.setDocumentDirection(requiredDirection);
        }
    }
    saveSettings() {
        var settings = this.settings.toJson();
        this.app.vault.adapter.write(this.SETTINGS_PATH, settings);
    }
    loadSettings() {
        this.app.vault.adapter.read(this.SETTINGS_PATH).
            then((content) => this.settings.fromJson(content)).
            catch(error => { console.log("RTL settings file not found"); });
    }
    getCmEditor() {
        var _a;
        let view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (view)
            return (_a = view.sourceMode) === null || _a === void 0 ? void 0 : _a.cmEditor;
        return null;
    }
    setDocumentDirection(newDirection) {
        let view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (!view || !(view === null || view === void 0 ? void 0 : view.editor))
            return;
        const editorDivs = view.contentEl.getElementsByClassName('cm-editor');
        for (const editorDiv of editorDivs) {
            if (editorDiv instanceof HTMLDivElement)
                this.setDocumentDirectionForEditorDiv(editorDiv, newDirection);
        }
        const markdownPreviews = view.contentEl.getElementsByClassName('markdown-preview-view');
        for (const preview of markdownPreviews) {
            if (preview instanceof HTMLDivElement)
                this.setDocumentDirectionForReadingDiv(preview, newDirection);
        }
        // --- General global fixes ---
        // Fix list indentation problems in RTL
        this.replacePageStyleByString('List indent fix', `/* List indent fix */ .is-rtl .HyperMD-list-line { text-indent: 0px !important; }`, true);
        this.replacePageStyleByString('CodeMirror-rtl pre', `.CodeMirror-rtl pre { text-indent: 0px !important; }`, true);
        // Embedded backlinks should always be shown as LTR
        this.replacePageStyleByString('Embedded links always LTR', `/* Embedded links always LTR */ .embedded-backlinks { direction: ltr; }`, true);
        // Fold indicator fix (not perfect yet -- it can't be clicked)
        this.replacePageStyleByString('Fold symbol fix', `/* Fold symbol fix*/ .is-rtl .cm-fold-indicator { right: -15px !important; }`, true);
        if (this.settings.setNoteTitleDirection) {
            const container = view.containerEl.parentElement;
            let header = container.getElementsByClassName('view-header-title-container');
            header[0].style.direction = newDirection;
        }
        view.editor.refresh();
        // Set the *currently active* export direction. This is global and changes every time the user
        // switches a pane
        this.setExportDirection(newDirection);
    }
    setDocumentDirectionForEditorDiv(editorDiv, newDirection) {
        editorDiv.style.direction = newDirection;
        if (newDirection === 'rtl') {
            editorDiv.parentElement.classList.add('is-rtl');
        }
        else {
            editorDiv.parentElement.classList.remove('is-rtl');
        }
    }
    setDocumentDirectionForReadingDiv(readingDiv, newDirection) {
        readingDiv.style.direction = newDirection;
        // Although Obsidian doesn't care about is-rtl in Markdown preview, we use it below for some more formatting
        if (newDirection === 'rtl')
            readingDiv.classList.add('is-rtl');
        else
            readingDiv.classList.remove('is-rtl');
        if (this.settings.setYamlDirection)
            this.replacePageStyleByString('Patch YAML', `/* Patch YAML RTL */ .is-rtl .language-yaml code { text-align: right; }`, true);
    }
    setExportDirection(newDirection) {
        this.replacePageStyleByString('searched and replaced', `/* This is searched and replaced by the plugin */ @media print { body { direction: ${newDirection}; } }`, false);
    }
    // Returns true if a replacement was made
    replacePageStyleByString(searchString, newStyle, addIfNotFound) {
        let alreadyExists = false;
        let style = this.findPageStyle(searchString);
        if (style) {
            if (style.getText() === searchString)
                alreadyExists = true;
            else
                style.setText(newStyle);
        }
        else if (addIfNotFound) {
            let style = document.createElement('style');
            style.textContent = newStyle;
            document.head.appendChild(style);
        }
        return style && !alreadyExists;
    }
    findPageStyle(regex) {
        let styles = document.head.getElementsByTagName('style');
        for (let style of styles) {
            if (style.getText().match(regex))
                return style;
        }
        return null;
    }
    toggleDocumentDirection() {
        let newDirection = this.getDocumentDirection() === 'ltr' ? 'rtl' : 'ltr';
        this.setDocumentDirection(newDirection);
        if (this.settings.rememberPerFile && this.currentFile && this.currentFile.path) {
            this.settings.fileDirections[this.currentFile.path] = newDirection;
            this.saveSettings();
        }
    }
    getDocumentDirection() {
        let view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (!view)
            return 'unknown';
        const rtlEditors = view.contentEl.getElementsByClassName('is-rtl');
        if (rtlEditors.length > 0)
            return 'rtl';
        else
            return 'ltr';
    }
    getFrontMatterDirection(file) {
        const fileCache = this.app.metadataCache.getFileCache(file);
        const frontMatter = fileCache === null || fileCache === void 0 ? void 0 : fileCache.frontmatter;
        if (frontMatter && (frontMatter === null || frontMatter === void 0 ? void 0 : frontMatter.direction)) {
            try {
                const direction = frontMatter.direction;
                return direction;
            }
            catch (error) { }
        }
    }
    syncDefaultDirection() {
        // Sync the plugin default direction with Obsidian's own setting
        const obsidianDirection = this.app.vault.getConfig('rightToLeft') ? 'rtl' : 'ltr';
        if (obsidianDirection != this.settings.defaultDirection) {
            this.settings.defaultDirection = obsidianDirection;
            this.saveSettings();
        }
    }
}
class RtlSettingsTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.settings = plugin.settings;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'RTL Settings' });
        this.plugin.syncDefaultDirection();
        new obsidian.Setting(containerEl)
            .setName('Remember text direction per file')
            .setDesc('Store and remember the text direction used for each file individually.')
            .addToggle(toggle => toggle.setValue(this.settings.rememberPerFile)
            .onChange((value) => {
            this.settings.rememberPerFile = value;
            this.plugin.saveSettings();
            this.plugin.adjustDirectionToCurrentFile();
        }));
        new obsidian.Setting(containerEl)
            .setName('Default text direction')
            .setDesc('What should be the default text direction in Obsidian?')
            .addDropdown(dropdown => dropdown.addOption('ltr', 'LTR')
            .addOption('rtl', 'RTL')
            .setValue(this.settings.defaultDirection)
            .onChange((value) => {
            this.settings.defaultDirection = value;
            this.app.vault.setConfig('rightToLeft', value == 'rtl');
            this.plugin.saveSettings();
            this.plugin.adjustDirectionToCurrentFile();
        }));
        new obsidian.Setting(containerEl)
            .setName('Set note title direction')
            .setDesc('In RTL notes, also set the direction of the note title.')
            .addToggle(toggle => toggle.setValue(this.settings.setNoteTitleDirection)
            .onChange((value) => {
            this.settings.setNoteTitleDirection = value;
            this.plugin.saveSettings();
            this.plugin.adjustDirectionToCurrentFile();
        }));
        new obsidian.Setting(containerEl)
            .setName('Set YAML direction in Preview')
            .setDesc('For RTL notes, preview YAML blocks as RTL. (When turning off, restart of Obsidian is required.)')
            .addToggle(toggle => {
            var _a;
            return toggle.setValue((_a = this.settings.setYamlDirection) !== null && _a !== void 0 ? _a : false)
                .onChange((value) => {
                this.settings.setYamlDirection = value;
                this.plugin.saveSettings();
                this.plugin.adjustDirectionToCurrentFile();
            });
        });
    }
}

module.exports = RtlPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIm1haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyohICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGc7XHJcbiAgICByZXR1cm4gZyA9IHsgbmV4dDogdmVyYigwKSwgXCJ0aHJvd1wiOiB2ZXJiKDEpLCBcInJldHVyblwiOiB2ZXJiKDIpIH0sIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfSk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWQoKSB7XHJcbiAgICBmb3IgKHZhciBhciA9IFtdLCBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKylcclxuICAgICAgICBhciA9IGFyLmNvbmNhdChfX3JlYWQoYXJndW1lbnRzW2ldKSk7XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaWYgKGdbbl0pIGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHJlc3VtZShuLCB2KSB7IHRyeSB7IHN0ZXAoZ1tuXSh2KSk7IH0gY2F0Y2ggKGUpIHsgc2V0dGxlKHFbMF1bM10sIGUpOyB9IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAocikgeyByLnZhbHVlIGluc3RhbmNlb2YgX19hd2FpdCA/IFByb21pc2UucmVzb2x2ZShyLnZhbHVlLnYpLnRoZW4oZnVsZmlsbCwgcmVqZWN0KSA6IHNldHRsZShxWzBdWzJdLCByKTsgfVxyXG4gICAgZnVuY3Rpb24gZnVsZmlsbCh2YWx1ZSkgeyByZXN1bWUoXCJuZXh0XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gcmVqZWN0KHZhbHVlKSB7IHJlc3VtZShcInRocm93XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKGYsIHYpIHsgaWYgKGYodiksIHEuc2hpZnQoKSwgcS5sZW5ndGgpIHJlc3VtZShxWzBdWzBdLCBxWzBdWzFdKTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0RlbGVnYXRvcihvKSB7XHJcbiAgICB2YXIgaSwgcDtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiwgZnVuY3Rpb24gKGUpIHsgdGhyb3cgZTsgfSksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4sIGYpIHsgaVtuXSA9IG9bbl0gPyBmdW5jdGlvbiAodikgeyByZXR1cm4gKHAgPSAhcCkgPyB7IHZhbHVlOiBfX2F3YWl0KG9bbl0odikpLCBkb25lOiBuID09PSBcInJldHVyblwiIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrIGluIG1vZCkgaWYgKGsgIT09IFwiZGVmYXVsdFwiICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtb2QsIGspKSBfX2NyZWF0ZUJpbmRpbmcocmVzdWx0LCBtb2QsIGspO1xyXG4gICAgX19zZXRNb2R1bGVEZWZhdWx0KHJlc3VsdCwgbW9kKTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydERlZmF1bHQobW9kKSB7XHJcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IGRlZmF1bHQ6IG1vZCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEdldChyZWNlaXZlciwgcHJpdmF0ZU1hcCkge1xyXG4gICAgaWYgKCFwcml2YXRlTWFwLmhhcyhyZWNlaXZlcikpIHtcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXR0ZW1wdGVkIHRvIGdldCBwcml2YXRlIGZpZWxkIG9uIG5vbi1pbnN0YW5jZVwiKTtcclxuICAgIH1cclxuICAgIHJldHVybiBwcml2YXRlTWFwLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBwcml2YXRlTWFwLCB2YWx1ZSkge1xyXG4gICAgaWYgKCFwcml2YXRlTWFwLmhhcyhyZWNlaXZlcikpIHtcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXR0ZW1wdGVkIHRvIHNldCBwcml2YXRlIGZpZWxkIG9uIG5vbi1pbnN0YW5jZVwiKTtcclxuICAgIH1cclxuICAgIHByaXZhdGVNYXAuc2V0KHJlY2VpdmVyLCB2YWx1ZSk7XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcbn1cclxuIiwiaW1wb3J0IHsgQXBwLCBXb3Jrc3BhY2VMZWFmLCBNYXJrZG93blZpZXcsIFBsdWdpbiwgUGx1Z2luU2V0dGluZ1RhYiwgVEZpbGUsIFRBYnN0cmFjdEZpbGUsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XHJcbmltcG9ydCAqIGFzIGNvZGVtaXJyb3IgZnJvbSAnY29kZW1pcnJvcic7XHJcblxyXG5jbGFzcyBTZXR0aW5ncyB7XHJcblx0cHVibGljIGZpbGVEaXJlY3Rpb25zOiB7IFtwYXRoOiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xyXG5cdHB1YmxpYyBkZWZhdWx0RGlyZWN0aW9uOiBzdHJpbmcgPSAnbHRyJztcclxuXHRwdWJsaWMgcmVtZW1iZXJQZXJGaWxlOiBib29sZWFuID0gdHJ1ZTtcclxuXHRwdWJsaWMgc2V0Tm90ZVRpdGxlRGlyZWN0aW9uOiBib29sZWFuID0gdHJ1ZTtcclxuXHRwdWJsaWMgc2V0WWFtbERpcmVjdGlvbjogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuXHR0b0pzb24oKSB7XHJcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcyk7XHJcblx0fVxyXG5cclxuXHRmcm9tSnNvbihjb250ZW50OiBzdHJpbmcpIHtcclxuXHRcdHZhciBvYmogPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xyXG5cdFx0dGhpcy5maWxlRGlyZWN0aW9ucyA9IG9ialsnZmlsZURpcmVjdGlvbnMnXTtcclxuXHRcdHRoaXMuZGVmYXVsdERpcmVjdGlvbiA9IG9ialsnZGVmYXVsdERpcmVjdGlvbiddO1xyXG5cdFx0dGhpcy5yZW1lbWJlclBlckZpbGUgPSBvYmpbJ3JlbWVtYmVyUGVyRmlsZSddO1xyXG5cdFx0dGhpcy5zZXROb3RlVGl0bGVEaXJlY3Rpb24gPSBvYmpbJ3NldE5vdGVUaXRsZURpcmVjdGlvbiddO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUnRsUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuXHRwdWJsaWMgc2V0dGluZ3MgPSBuZXcgU2V0dGluZ3MoKTtcclxuXHRwcml2YXRlIGN1cnJlbnRGaWxlOiBURmlsZTtcclxuXHRwdWJsaWMgU0VUVElOR1NfUEFUSCA9ICcub2JzaWRpYW4vcnRsLmpzb24nXHJcblx0Ly8gVGhpcyBzdG9yZXMgdGhlIHZhbHVlIGluIENvZGVNaXJyb3IncyBhdXRvQ2xvc2VCcmFja2V0cyBvcHRpb24gYmVmb3JlIG92ZXJyaWRpbmcgaXQsIHNvIGl0IGNhbiBiZSByZXN0b3JlZCB3aGVuXHJcblx0Ly8gd2UncmUgYmFjayB0byBMVFJcclxuXHRwcml2YXRlIGF1dG9DbG9zZUJyYWNrZXRzVmFsdWU6IGFueSA9IGZhbHNlO1xyXG5cdHByaXZhdGUgaW5pdGlhbGl6ZWQgPSBmYWxzZTtcclxuXHJcblx0b25sb2FkKCkge1xyXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcclxuXHRcdFx0aWQ6ICdzd2l0Y2gtdGV4dC1kaXJlY3Rpb24nLFxyXG5cdFx0XHRuYW1lOiAnU3dpdGNoIFRleHQgRGlyZWN0aW9uIChMVFI8PlJUTCknLFxyXG5cdFx0XHRjYWxsYmFjazogKCkgPT4geyB0aGlzLnRvZ2dsZURvY3VtZW50RGlyZWN0aW9uKCk7IH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgUnRsU2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcblx0XHR0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG5cclxuXHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbignYWN0aXZlLWxlYWYtY2hhbmdlJywgYXN5bmMgKGxlYWY6IFdvcmtzcGFjZUxlYWYpID0+IHtcclxuXHRcdFx0aWYgKGxlYWYudmlldyBpbnN0YW5jZW9mIE1hcmtkb3duVmlldykge1xyXG5cdFx0XHRcdGNvbnN0IGZpbGUgPSBsZWFmLnZpZXcuZmlsZTtcclxuXHRcdFx0XHRhd2FpdCB0aGlzLm9uRmlsZU9wZW4oZmlsZSk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuYXBwLndvcmtzcGFjZS5vbignZmlsZS1vcGVuJywgYXN5bmMgKGZpbGU6IFRGaWxlKSA9PiB7XHJcblx0XHRcdGF3YWl0IHRoaXMub25GaWxlT3BlbihmaWxlKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbignZGVsZXRlJywgKGZpbGU6IFRBYnN0cmFjdEZpbGUpID0+IHtcclxuXHRcdFx0aWYgKGZpbGUgJiYgZmlsZS5wYXRoICYmIGZpbGUucGF0aCBpbiB0aGlzLnNldHRpbmdzLmZpbGVEaXJlY3Rpb25zKSB7XHJcblx0XHRcdFx0ZGVsZXRlIHRoaXMuc2V0dGluZ3MuZmlsZURpcmVjdGlvbnNbZmlsZS5wYXRoXTtcclxuXHRcdFx0XHR0aGlzLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHR9XHJcblx0XHR9KSk7XHJcblxyXG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdyZW5hbWUnLCAoZmlsZTogVEFic3RyYWN0RmlsZSwgb2xkUGF0aDogc3RyaW5nKSA9PiB7XHJcblx0XHRcdGlmIChmaWxlICYmIGZpbGUucGF0aCAmJiBvbGRQYXRoIGluIHRoaXMuc2V0dGluZ3MuZmlsZURpcmVjdGlvbnMpIHtcclxuXHRcdFx0XHR0aGlzLnNldHRpbmdzLmZpbGVEaXJlY3Rpb25zW2ZpbGUucGF0aF0gPSB0aGlzLnNldHRpbmdzLmZpbGVEaXJlY3Rpb25zW29sZFBhdGhdO1xyXG5cdFx0XHRcdGRlbGV0ZSB0aGlzLnNldHRpbmdzLmZpbGVEaXJlY3Rpb25zW29sZFBhdGhdO1xyXG5cdFx0XHRcdHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdH1cclxuXHRcdH0pKTtcclxuXHJcblx0fVxyXG5cclxuXHRhc3luYyBpbml0aWFsaXplKCkge1xyXG5cdFx0dGhpcy5pbml0aWFsaXplZCA9IHRydWU7XHJcblx0fVxyXG5cclxuXHRvbnVubG9hZCgpIHtcclxuXHRcdGNvbnNvbGUubG9nKCd1bmxvYWRpbmcgUlRMIHBsdWdpbicpO1xyXG5cdH1cclxuXHJcblx0YXN5bmMgb25GaWxlT3BlbihmaWxlOiBURmlsZSkge1xyXG5cdFx0aWYgKCF0aGlzLmluaXRpYWxpemVkKVxyXG5cdFx0XHRhd2FpdCB0aGlzLmluaXRpYWxpemUoKTtcclxuXHRcdGlmIChmaWxlICYmIGZpbGUucGF0aCkge1xyXG5cdFx0XHR0aGlzLnN5bmNEZWZhdWx0RGlyZWN0aW9uKCk7XHJcblx0XHRcdHRoaXMuY3VycmVudEZpbGUgPSBmaWxlO1xyXG5cdFx0XHR0aGlzLmFkanVzdERpcmVjdGlvblRvQ3VycmVudEZpbGUoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGFkanVzdERpcmVjdGlvblRvQ3VycmVudEZpbGUoKSB7XHJcblx0XHRpZiAodGhpcy5jdXJyZW50RmlsZSAmJiB0aGlzLmN1cnJlbnRGaWxlLnBhdGgpIHtcclxuXHRcdFx0bGV0IHJlcXVpcmVkRGlyZWN0aW9uID0gbnVsbDtcclxuXHRcdFx0Y29uc3QgZnJvbnRNYXR0ZXJEaXJlY3Rpb24gPSB0aGlzLmdldEZyb250TWF0dGVyRGlyZWN0aW9uKHRoaXMuY3VycmVudEZpbGUpO1xyXG5cdFx0XHRpZiAoZnJvbnRNYXR0ZXJEaXJlY3Rpb24pIHtcclxuXHRcdFx0XHRpZiAoZnJvbnRNYXR0ZXJEaXJlY3Rpb24gPT0gJ3J0bCcgfHwgZnJvbnRNYXR0ZXJEaXJlY3Rpb24gPT0gJ2x0cicpXHJcblx0XHRcdFx0XHRyZXF1aXJlZERpcmVjdGlvbiA9IGZyb250TWF0dGVyRGlyZWN0aW9uO1xyXG5cdFx0XHRcdGVsc2VcclxuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdGcm9udCBtYXR0ZXIgZGlyZWN0aW9uIGluIGZpbGUnLCB0aGlzLmN1cnJlbnRGaWxlLnBhdGgsICdpcyB1bmtub3duOicsIGZyb250TWF0dGVyRGlyZWN0aW9uKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIGlmICh0aGlzLnNldHRpbmdzLnJlbWVtYmVyUGVyRmlsZSAmJiB0aGlzLmN1cnJlbnRGaWxlLnBhdGggaW4gdGhpcy5zZXR0aW5ncy5maWxlRGlyZWN0aW9ucykge1xyXG5cdFx0XHRcdC8vIElmIHRoZSB1c2VyIHdhbnRzIHRvIHJlbWVtYmVyIHRoZSBkaXJlY3Rpb24gcGVyIGZpbGUsIGFuZCB3ZSBoYXZlIGEgZGlyZWN0aW9uIHNldCBmb3IgdGhpcyBmaWxlIC0tIHVzZSBpdFxyXG5cdFx0XHRcdHJlcXVpcmVkRGlyZWN0aW9uID0gdGhpcy5zZXR0aW5ncy5maWxlRGlyZWN0aW9uc1t0aGlzLmN1cnJlbnRGaWxlLnBhdGhdO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIFVzZSB0aGUgZGVmYXVsdCBkaXJlY3Rpb25cclxuXHRcdFx0XHRyZXF1aXJlZERpcmVjdGlvbiA9IHRoaXMuc2V0dGluZ3MuZGVmYXVsdERpcmVjdGlvbjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLnNldERvY3VtZW50RGlyZWN0aW9uKHJlcXVpcmVkRGlyZWN0aW9uKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHNhdmVTZXR0aW5ncygpIHtcclxuXHRcdHZhciBzZXR0aW5ncyA9IHRoaXMuc2V0dGluZ3MudG9Kc29uKCk7XHJcblx0XHR0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKHRoaXMuU0VUVElOR1NfUEFUSCwgc2V0dGluZ3MpO1xyXG5cdH1cclxuXHJcblx0bG9hZFNldHRpbmdzKCkge1xyXG5cdFx0dGhpcy5hcHAudmF1bHQuYWRhcHRlci5yZWFkKHRoaXMuU0VUVElOR1NfUEFUSCkuXHJcblx0XHRcdHRoZW4oKGNvbnRlbnQpID0+IHRoaXMuc2V0dGluZ3MuZnJvbUpzb24oY29udGVudCkpLlxyXG5cdFx0XHRjYXRjaChlcnJvciA9PiB7IGNvbnNvbGUubG9nKFwiUlRMIHNldHRpbmdzIGZpbGUgbm90IGZvdW5kXCIpOyB9KTtcclxuXHR9XHJcblxyXG5cdGdldENtRWRpdG9yKCk6IGNvZGVtaXJyb3IuRWRpdG9yIHtcclxuXHRcdGxldCB2aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuXHRcdGlmICh2aWV3KVxyXG5cdFx0XHRyZXR1cm4gdmlldy5zb3VyY2VNb2RlPy5jbUVkaXRvcjtcclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHJcblx0c2V0RG9jdW1lbnREaXJlY3Rpb24obmV3RGlyZWN0aW9uOiBzdHJpbmcpIHtcclxuXHRcdGxldCB2aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuXHRcdGlmICghdmlldyB8fCAhdmlldz8uZWRpdG9yKVxyXG5cdFx0XHRyZXR1cm47XHJcblxyXG5cdFx0Y29uc3QgZWRpdG9yRGl2cyA9IHZpZXcuY29udGVudEVsLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2NtLWVkaXRvcicpO1xyXG5cdFx0Zm9yIChjb25zdCBlZGl0b3JEaXYgb2YgZWRpdG9yRGl2cykge1xyXG5cdFx0XHRpZiAoZWRpdG9yRGl2IGluc3RhbmNlb2YgSFRNTERpdkVsZW1lbnQpXHJcblx0XHRcdFx0dGhpcy5zZXREb2N1bWVudERpcmVjdGlvbkZvckVkaXRvckRpdihlZGl0b3JEaXYsIG5ld0RpcmVjdGlvbik7XHJcblx0XHR9XHJcblx0XHRjb25zdCBtYXJrZG93blByZXZpZXdzID0gdmlldy5jb250ZW50RWwuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnbWFya2Rvd24tcHJldmlldy12aWV3Jyk7XHJcblx0XHRmb3IgKGNvbnN0IHByZXZpZXcgb2YgbWFya2Rvd25QcmV2aWV3cykge1xyXG5cdFx0XHRpZiAocHJldmlldyBpbnN0YW5jZW9mIEhUTUxEaXZFbGVtZW50KSBcclxuXHRcdFx0XHR0aGlzLnNldERvY3VtZW50RGlyZWN0aW9uRm9yUmVhZGluZ0RpdihwcmV2aWV3LCBuZXdEaXJlY3Rpb24pO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLSBHZW5lcmFsIGdsb2JhbCBmaXhlcyAtLS1cclxuXHRcdFxyXG5cdFx0Ly8gRml4IGxpc3QgaW5kZW50YXRpb24gcHJvYmxlbXMgaW4gUlRMXHJcblx0XHR0aGlzLnJlcGxhY2VQYWdlU3R5bGVCeVN0cmluZygnTGlzdCBpbmRlbnQgZml4JyxcclxuXHRcdFx0YC8qIExpc3QgaW5kZW50IGZpeCAqLyAuaXMtcnRsIC5IeXBlck1ELWxpc3QtbGluZSB7IHRleHQtaW5kZW50OiAwcHggIWltcG9ydGFudDsgfWAsIHRydWUpO1xyXG5cdFx0dGhpcy5yZXBsYWNlUGFnZVN0eWxlQnlTdHJpbmcoJ0NvZGVNaXJyb3ItcnRsIHByZScsXHJcblx0XHRcdGAuQ29kZU1pcnJvci1ydGwgcHJlIHsgdGV4dC1pbmRlbnQ6IDBweCAhaW1wb3J0YW50OyB9YCxcclxuXHRcdFx0dHJ1ZSk7XHJcblxyXG5cdFx0Ly8gRW1iZWRkZWQgYmFja2xpbmtzIHNob3VsZCBhbHdheXMgYmUgc2hvd24gYXMgTFRSXHJcblx0XHR0aGlzLnJlcGxhY2VQYWdlU3R5bGVCeVN0cmluZygnRW1iZWRkZWQgbGlua3MgYWx3YXlzIExUUicsXHJcblx0XHRcdGAvKiBFbWJlZGRlZCBsaW5rcyBhbHdheXMgTFRSICovIC5lbWJlZGRlZC1iYWNrbGlua3MgeyBkaXJlY3Rpb246IGx0cjsgfWAsIHRydWUpO1xyXG5cclxuXHRcdC8vIEZvbGQgaW5kaWNhdG9yIGZpeCAobm90IHBlcmZlY3QgeWV0IC0tIGl0IGNhbid0IGJlIGNsaWNrZWQpXHJcblx0XHR0aGlzLnJlcGxhY2VQYWdlU3R5bGVCeVN0cmluZygnRm9sZCBzeW1ib2wgZml4JyxcclxuXHRcdFx0YC8qIEZvbGQgc3ltYm9sIGZpeCovIC5pcy1ydGwgLmNtLWZvbGQtaW5kaWNhdG9yIHsgcmlnaHQ6IC0xNXB4ICFpbXBvcnRhbnQ7IH1gLCB0cnVlKTtcclxuXHJcblx0XHRpZiAodGhpcy5zZXR0aW5ncy5zZXROb3RlVGl0bGVEaXJlY3Rpb24pIHtcclxuXHRcdFx0Y29uc3QgY29udGFpbmVyID0gdmlldy5jb250YWluZXJFbC5wYXJlbnRFbGVtZW50O1xyXG5cdFx0XHRsZXQgaGVhZGVyID0gY29udGFpbmVyLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3ZpZXctaGVhZGVyLXRpdGxlLWNvbnRhaW5lcicpO1xyXG5cdFx0XHQoaGVhZGVyWzBdIGFzIEhUTUxEaXZFbGVtZW50KS5zdHlsZS5kaXJlY3Rpb24gPSBuZXdEaXJlY3Rpb247XHJcblx0XHR9XHJcblxyXG5cdFx0dmlldy5lZGl0b3IucmVmcmVzaCgpO1xyXG5cclxuXHRcdC8vIFNldCB0aGUgKmN1cnJlbnRseSBhY3RpdmUqIGV4cG9ydCBkaXJlY3Rpb24uIFRoaXMgaXMgZ2xvYmFsIGFuZCBjaGFuZ2VzIGV2ZXJ5IHRpbWUgdGhlIHVzZXJcclxuXHRcdC8vIHN3aXRjaGVzIGEgcGFuZVxyXG5cdFx0dGhpcy5zZXRFeHBvcnREaXJlY3Rpb24obmV3RGlyZWN0aW9uKTtcclxuXHR9XHJcblxyXG5cdHNldERvY3VtZW50RGlyZWN0aW9uRm9yRWRpdG9yRGl2KGVkaXRvckRpdjogSFRNTERpdkVsZW1lbnQsIG5ld0RpcmVjdGlvbjogc3RyaW5nKSB7XHJcblx0XHRlZGl0b3JEaXYuc3R5bGUuZGlyZWN0aW9uID0gbmV3RGlyZWN0aW9uO1xyXG5cdFx0aWYgKG5ld0RpcmVjdGlvbiA9PT0gJ3J0bCcpIHtcclxuXHRcdFx0ZWRpdG9yRGl2LnBhcmVudEVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnaXMtcnRsJyk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRlZGl0b3JEaXYucGFyZW50RWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdpcy1ydGwnKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHNldERvY3VtZW50RGlyZWN0aW9uRm9yUmVhZGluZ0RpdihyZWFkaW5nRGl2OiBIVE1MRGl2RWxlbWVudCwgbmV3RGlyZWN0aW9uOiBzdHJpbmcpIHtcclxuXHRcdHJlYWRpbmdEaXYuc3R5bGUuZGlyZWN0aW9uID0gbmV3RGlyZWN0aW9uO1xyXG5cdFx0Ly8gQWx0aG91Z2ggT2JzaWRpYW4gZG9lc24ndCBjYXJlIGFib3V0IGlzLXJ0bCBpbiBNYXJrZG93biBwcmV2aWV3LCB3ZSB1c2UgaXQgYmVsb3cgZm9yIHNvbWUgbW9yZSBmb3JtYXR0aW5nXHJcblx0XHRpZiAobmV3RGlyZWN0aW9uID09PSAncnRsJylcclxuXHRcdFx0cmVhZGluZ0Rpdi5jbGFzc0xpc3QuYWRkKCdpcy1ydGwnKTtcclxuXHRcdGVsc2VcclxuXHRcdFx0cmVhZGluZ0Rpdi5jbGFzc0xpc3QucmVtb3ZlKCdpcy1ydGwnKTtcclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLnNldFlhbWxEaXJlY3Rpb24pXHJcblx0XHRcdHRoaXMucmVwbGFjZVBhZ2VTdHlsZUJ5U3RyaW5nKCdQYXRjaCBZQU1MJyxcclxuXHRcdFx0XHRgLyogUGF0Y2ggWUFNTCBSVEwgKi8gLmlzLXJ0bCAubGFuZ3VhZ2UteWFtbCBjb2RlIHsgdGV4dC1hbGlnbjogcmlnaHQ7IH1gLCB0cnVlKTtcclxuXHR9XHJcblxyXG5cdHNldEV4cG9ydERpcmVjdGlvbihuZXdEaXJlY3Rpb246IHN0cmluZykge1xyXG5cdFx0dGhpcy5yZXBsYWNlUGFnZVN0eWxlQnlTdHJpbmcoJ3NlYXJjaGVkIGFuZCByZXBsYWNlZCcsXHJcblx0XHRcdGAvKiBUaGlzIGlzIHNlYXJjaGVkIGFuZCByZXBsYWNlZCBieSB0aGUgcGx1Z2luICovIEBtZWRpYSBwcmludCB7IGJvZHkgeyBkaXJlY3Rpb246ICR7bmV3RGlyZWN0aW9ufTsgfSB9YCxcclxuXHRcdFx0ZmFsc2UpO1xyXG5cdH1cclxuXHJcblx0Ly8gUmV0dXJucyB0cnVlIGlmIGEgcmVwbGFjZW1lbnQgd2FzIG1hZGVcclxuXHRyZXBsYWNlUGFnZVN0eWxlQnlTdHJpbmcoc2VhcmNoU3RyaW5nOiBzdHJpbmcsIG5ld1N0eWxlOiBzdHJpbmcsIGFkZElmTm90Rm91bmQ6IGJvb2xlYW4pIHtcclxuXHRcdGxldCBhbHJlYWR5RXhpc3RzID0gZmFsc2U7XHJcblx0XHRsZXQgc3R5bGUgPSB0aGlzLmZpbmRQYWdlU3R5bGUoc2VhcmNoU3RyaW5nKTtcclxuXHRcdGlmIChzdHlsZSkge1xyXG5cdFx0XHRpZiAoc3R5bGUuZ2V0VGV4dCgpID09PSBzZWFyY2hTdHJpbmcpXHJcblx0XHRcdFx0YWxyZWFkeUV4aXN0cyA9IHRydWU7XHJcblx0XHRcdGVsc2VcclxuXHRcdFx0XHRzdHlsZS5zZXRUZXh0KG5ld1N0eWxlKTtcclxuXHRcdH0gZWxzZSBpZiAoYWRkSWZOb3RGb3VuZCkge1xyXG5cdFx0XHRsZXQgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xyXG5cdFx0XHRzdHlsZS50ZXh0Q29udGVudCA9IG5ld1N0eWxlO1xyXG5cdFx0XHRkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBzdHlsZSAmJiAhYWxyZWFkeUV4aXN0cztcclxuXHR9XHJcblxyXG5cdGZpbmRQYWdlU3R5bGUocmVnZXg6IHN0cmluZykge1xyXG5cdFx0bGV0IHN0eWxlcyA9IGRvY3VtZW50LmhlYWQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3N0eWxlJyk7XHJcblx0XHRmb3IgKGxldCBzdHlsZSBvZiBzdHlsZXMpIHtcclxuXHRcdFx0aWYgKHN0eWxlLmdldFRleHQoKS5tYXRjaChyZWdleCkpXHJcblx0XHRcdFx0cmV0dXJuIHN0eWxlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG51bGw7XHJcblx0fVxyXG5cclxuXHR0b2dnbGVEb2N1bWVudERpcmVjdGlvbigpIHtcclxuXHRcdGxldCBuZXdEaXJlY3Rpb24gPSB0aGlzLmdldERvY3VtZW50RGlyZWN0aW9uKCkgPT09ICdsdHInID8gJ3J0bCcgOiAnbHRyJztcclxuXHRcdHRoaXMuc2V0RG9jdW1lbnREaXJlY3Rpb24obmV3RGlyZWN0aW9uKTtcclxuXHRcdGlmICh0aGlzLnNldHRpbmdzLnJlbWVtYmVyUGVyRmlsZSAmJiB0aGlzLmN1cnJlbnRGaWxlICYmIHRoaXMuY3VycmVudEZpbGUucGF0aCkge1xyXG5cdFx0XHR0aGlzLnNldHRpbmdzLmZpbGVEaXJlY3Rpb25zW3RoaXMuY3VycmVudEZpbGUucGF0aF0gPSBuZXdEaXJlY3Rpb247XHJcblx0XHRcdHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRnZXREb2N1bWVudERpcmVjdGlvbigpIHtcclxuXHRcdGxldCB2aWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuXHRcdGlmICghdmlldylcclxuXHRcdFx0cmV0dXJuICd1bmtub3duJztcclxuXHRcdGNvbnN0IHJ0bEVkaXRvcnMgPSB2aWV3LmNvbnRlbnRFbC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdpcy1ydGwnKTtcclxuXHRcdGlmIChydGxFZGl0b3JzLmxlbmd0aCA+IDApXHJcblx0XHRcdHJldHVybiAncnRsJztcclxuXHRcdGVsc2VcclxuXHRcdFx0cmV0dXJuICdsdHInO1xyXG5cdH1cclxuXHJcblx0Z2V0RnJvbnRNYXR0ZXJEaXJlY3Rpb24oZmlsZTogVEZpbGUpIHtcclxuXHRcdGNvbnN0IGZpbGVDYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKGZpbGUpO1xyXG5cdFx0Y29uc3QgZnJvbnRNYXR0ZXIgPSBmaWxlQ2FjaGU/LmZyb250bWF0dGVyO1xyXG5cdFx0aWYgKGZyb250TWF0dGVyICYmIGZyb250TWF0dGVyPy5kaXJlY3Rpb24pIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zdCBkaXJlY3Rpb24gPSBmcm9udE1hdHRlci5kaXJlY3Rpb247XHJcblx0XHRcdFx0cmV0dXJuIGRpcmVjdGlvbjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXRjaCAoZXJyb3IpIHt9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRzeW5jRGVmYXVsdERpcmVjdGlvbigpIHtcclxuXHRcdC8vIFN5bmMgdGhlIHBsdWdpbiBkZWZhdWx0IGRpcmVjdGlvbiB3aXRoIE9ic2lkaWFuJ3Mgb3duIHNldHRpbmdcclxuXHRcdGNvbnN0IG9ic2lkaWFuRGlyZWN0aW9uID0gKHRoaXMuYXBwLnZhdWx0IGFzIGFueSkuZ2V0Q29uZmlnKCdyaWdodFRvTGVmdCcpID8gJ3J0bCcgOiAnbHRyJztcclxuXHRcdGlmIChvYnNpZGlhbkRpcmVjdGlvbiAhPSB0aGlzLnNldHRpbmdzLmRlZmF1bHREaXJlY3Rpb24pIHtcclxuXHRcdFx0dGhpcy5zZXR0aW5ncy5kZWZhdWx0RGlyZWN0aW9uID0gb2JzaWRpYW5EaXJlY3Rpb247XHJcblx0XHRcdHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5jbGFzcyBSdGxTZXR0aW5nc1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG5cdHNldHRpbmdzOiBTZXR0aW5ncztcclxuXHRwbHVnaW46IFJ0bFBsdWdpbjtcclxuXHJcblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogUnRsUGx1Z2luKSB7XHJcblx0XHRzdXBlcihhcHAsIHBsdWdpbik7XHJcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuXHRcdHRoaXMuc2V0dGluZ3MgPSBwbHVnaW4uc2V0dGluZ3M7XHJcblx0fVxyXG5cclxuXHRkaXNwbGF5KCk6IHZvaWQge1xyXG5cdFx0bGV0IHtjb250YWluZXJFbH0gPSB0aGlzO1xyXG5cclxuXHRcdGNvbnRhaW5lckVsLmVtcHR5KCk7XHJcblxyXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywge3RleHQ6ICdSVEwgU2V0dGluZ3MnfSk7XHJcblxyXG5cdFx0dGhpcy5wbHVnaW4uc3luY0RlZmF1bHREaXJlY3Rpb24oKTtcclxuXHJcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuXHRcdFx0LnNldE5hbWUoJ1JlbWVtYmVyIHRleHQgZGlyZWN0aW9uIHBlciBmaWxlJylcclxuXHRcdFx0LnNldERlc2MoJ1N0b3JlIGFuZCByZW1lbWJlciB0aGUgdGV4dCBkaXJlY3Rpb24gdXNlZCBmb3IgZWFjaCBmaWxlIGluZGl2aWR1YWxseS4nKVxyXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy5yZW1lbWJlclBlckZpbGUpXHJcblx0XHRcdFx0XHQgICAub25DaGFuZ2UoKHZhbHVlKSA9PiB7XHJcblx0XHRcdFx0XHRcdCAgIHRoaXMuc2V0dGluZ3MucmVtZW1iZXJQZXJGaWxlID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdCAgIHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xyXG5cdFx0XHRcdFx0XHQgICB0aGlzLnBsdWdpbi5hZGp1c3REaXJlY3Rpb25Ub0N1cnJlbnRGaWxlKCk7XHJcblx0XHRcdFx0XHQgICB9KSk7XHJcblxyXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcblx0XHRcdC5zZXROYW1lKCdEZWZhdWx0IHRleHQgZGlyZWN0aW9uJylcclxuXHRcdFx0LnNldERlc2MoJ1doYXQgc2hvdWxkIGJlIHRoZSBkZWZhdWx0IHRleHQgZGlyZWN0aW9uIGluIE9ic2lkaWFuPycpXHJcblx0XHRcdC5hZGREcm9wZG93bihkcm9wZG93biA9PiBkcm9wZG93bi5hZGRPcHRpb24oJ2x0cicsICdMVFInKVxyXG5cdFx0XHRcdFx0XHQgLmFkZE9wdGlvbigncnRsJywgJ1JUTCcpXHJcblx0XHRcdFx0XHRcdCAuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy5kZWZhdWx0RGlyZWN0aW9uKVxyXG5cdFx0XHRcdFx0XHQgLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRcdCB0aGlzLnNldHRpbmdzLmRlZmF1bHREaXJlY3Rpb24gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0XHQgKHRoaXMuYXBwLnZhdWx0IGFzIGFueSkuc2V0Q29uZmlnKCdyaWdodFRvTGVmdCcsIHZhbHVlID09ICdydGwnKTtcclxuXHRcdFx0XHRcdFx0XHQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHRcdFx0IHRoaXMucGx1Z2luLmFkanVzdERpcmVjdGlvblRvQ3VycmVudEZpbGUoKTtcclxuXHRcdFx0XHRcdFx0IH0pKTtcclxuXHJcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuXHRcdFx0LnNldE5hbWUoJ1NldCBub3RlIHRpdGxlIGRpcmVjdGlvbicpXHJcblx0XHRcdC5zZXREZXNjKCdJbiBSVEwgbm90ZXMsIGFsc28gc2V0IHRoZSBkaXJlY3Rpb24gb2YgdGhlIG5vdGUgdGl0bGUuJylcclxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlLnNldFZhbHVlKHRoaXMuc2V0dGluZ3Muc2V0Tm90ZVRpdGxlRGlyZWN0aW9uKVxyXG5cdFx0XHRcdFx0XHQgLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRcdCB0aGlzLnNldHRpbmdzLnNldE5vdGVUaXRsZURpcmVjdGlvbiA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRcdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcclxuXHRcdFx0XHRcdFx0XHQgdGhpcy5wbHVnaW4uYWRqdXN0RGlyZWN0aW9uVG9DdXJyZW50RmlsZSgpO1xyXG5cdFx0XHRcdFx0XHQgfSkpO1xyXG5cclxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG5cdFx0XHQuc2V0TmFtZSgnU2V0IFlBTUwgZGlyZWN0aW9uIGluIFByZXZpZXcnKVxyXG5cdFx0XHQuc2V0RGVzYygnRm9yIFJUTCBub3RlcywgcHJldmlldyBZQU1MIGJsb2NrcyBhcyBSVEwuIChXaGVuIHR1cm5pbmcgb2ZmLCByZXN0YXJ0IG9mIE9ic2lkaWFuIGlzIHJlcXVpcmVkLiknKVxyXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB0b2dnbGUuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy5zZXRZYW1sRGlyZWN0aW9uID8/IGZhbHNlKVxyXG5cdFx0XHRcdFx0XHQgLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xyXG5cdFx0XHRcdFx0XHRcdCB0aGlzLnNldHRpbmdzLnNldFlhbWxEaXJlY3Rpb24gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0XHQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XHJcblx0XHRcdFx0XHRcdFx0IHRoaXMucGx1Z2luLmFkanVzdERpcmVjdGlvblRvQ3VycmVudEZpbGUoKTtcclxuXHRcdFx0XHRcdFx0IH0pKTtcclxuXHR9XHJcbn1cclxuIl0sIm5hbWVzIjpbIlBsdWdpbiIsIk1hcmtkb3duVmlldyIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXFEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDdEcsUUFBUSxTQUFTLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUU7QUFDdEgsUUFBUSxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsVUFBVSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDOUUsS0FBSyxDQUFD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
