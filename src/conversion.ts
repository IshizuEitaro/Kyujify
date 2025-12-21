import * as vscode from 'vscode';
import * as path from 'path';
import { getSettings } from './settings';

export function convertText(text: string, to: 'kyujitai' | 'shinjitai', defaultPairs: [string, string][], exclusions: string[] = [], symbol: string = ''): string {
    if (symbol) {
        const lines = text.split('\n');
        const convertedLines = lines.map(line => {
            if (line.startsWith(symbol)) {
                const trimmedLine = line.slice(symbol.length);
                return symbol + convertLine(trimmedLine, to, defaultPairs, exclusions, symbol);
            }
            return line;
        });
        return convertedLines.join('\n');
    } else {
        return convertLine(text, to, defaultPairs, exclusions, symbol);
    }
}

async function loadVariantGroupsFromFile(filePath: string, context: vscode.ExtensionContext): Promise<string[][] | null> {
    console.log(`[Kyujify] Attempting to load variant groups from: ${filePath}`);
    try {
        let resolvedPath = filePath;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceFolder = workspaceFolders[0].uri.fsPath;
            resolvedPath = resolvedPath.replace(/\${workspaceFolder}/g, workspaceFolder);
        }

        let fileUri: vscode.Uri;
        if (path.isAbsolute(resolvedPath)) {
            fileUri = vscode.Uri.file(resolvedPath);
        } else {
            fileUri = vscode.Uri.joinPath(context.extensionUri, resolvedPath);
        }

        console.log(`[Kyujify] Constructed variants file URI: ${fileUri.toString()}`);
        const fileContent = await vscode.workspace.fs.readFile(fileUri);
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(fileContent);
        const groups = JSON.parse(jsonString);

        if (!Array.isArray(groups)) {
            throw new Error('Variant file root must be an array');
        }

        const normalized: string[][] = [];
        for (const g of groups) {
            if (Array.isArray(g)) {
                const clean = g
                    .map(ch => (typeof ch === 'string' ? ch.normalize('NFC') : ''))
                    .filter(ch => ch.length > 0);
                if (clean.length >= 2) {
                    normalized.push(clean);
                }
            }
        }

        console.log(`[Kyujify] Successfully loaded ${normalized.length} variant groups from ${filePath}`);
        return normalized;
    } catch (error: any) {
        console.error(`[Kyujify] ERROR in loadVariantGroupsFromFile for ${filePath}:`, error);
        return null;
    }
}

function buildNextVariantMap(variantGroups: string[][]): Record<string, string> {
    const nextMap: Record<string, string> = {};
    for (const group of variantGroups) {
        const len = group.length;
        if (len < 2) {
            continue;
        }
        for (let i = 0; i < len; i++) {
            const from = group[i];
            const to = group[(i + 1) % len];
            if (from && to && from !== to) {
                nextMap[from] = to;
            }
        }
    }
    return nextMap;
}

export function cycleVariantsInText(text: string, nextVariantMap: Record<string, string>): string {
    let result = '';
    for (const ch of text) {
        const mapped = nextVariantMap[ch] || ch;
        result += mapped;
    }
    return result;
}

export async function getNextVariantMap(context: vscode.ExtensionContext): Promise<Record<string, string>> {
    const defaultPath = './data/default_variants.json';
    const groups = await loadVariantGroupsFromFile(defaultPath, context);
    if (!groups) {
        console.warn('[Kyujify] No variant groups loaded; Cycle Variants will be a no-op.');
        return {};
    }
    return buildNextVariantMap(groups);
}

function convertLine(text: string, to: 'kyujitai' | 'shinjitai', defaultPairs: [string, string][], exclusions: string[], symbol: string): string {
    let convertedText = text.normalize('NFC');
    const exclusionPlaceholders: { [key: string]: string } = {};

    exclusions.forEach((exclusion, index) => {
        if (convertedText.includes(exclusion.normalize('NFC'))) {
            const placeholder = `__EXCLUSION_${index}__`;
            const normalizedExclusion = exclusion.normalize('NFC');
            exclusionPlaceholders[placeholder] = normalizedExclusion;
            convertedText = convertedText.replaceAll(normalizedExclusion, placeholder);
        }
    });

    for (const [shinjitai, kyujitai] of defaultPairs) {
        const from = (to === 'kyujitai' ? shinjitai : kyujitai).normalize('NFC');
        const toChar = (to === 'kyujitai' ? kyujitai : shinjitai).normalize('NFC');
        convertedText = convertedText.split(from).join(toChar);
    }

    Object.entries(exclusionPlaceholders).forEach(([placeholder, original]) => {
        convertedText = convertedText.replaceAll(placeholder, original);
    });

    return convertedText;
}

async function loadConversionPairsFromFile(filePath: string, context: vscode.ExtensionContext): Promise<[string, string][] | null> {
    console.log(`[Kyujify] Attempting to load pairs from: ${filePath}`);
    try {
        let resolvedPath = filePath;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceFolder = workspaceFolders[0].uri.fsPath;
            resolvedPath = resolvedPath.replace(/\${workspaceFolder}/g, workspaceFolder);
        }

        let fileUri: vscode.Uri;
        if (path.isAbsolute(resolvedPath)) {
            fileUri = vscode.Uri.file(resolvedPath);
        } else {
            fileUri = vscode.Uri.joinPath(context.extensionUri, resolvedPath);
        }
        
        console.log(`[Kyujify] Constructed file URI: ${fileUri.toString()}`);
        const fileContent = await vscode.workspace.fs.readFile(fileUri);
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(fileContent);
        const pairs = JSON.parse(jsonString);
        console.log(`[Kyujify] Successfully loaded and parsed ${filePath}`);
        return pairs;
    } catch (error: any) {
        console.error(`[Kyujify] ERROR in loadConversionPairsFromFile for ${filePath}:`, error);
        return null;
    }
}

export async function getConversionPairs(settings: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): Promise<[string, string][]> {
    console.log('[Kyujify] getConversionPairs called.');
    const settingsObj = getSettings(settings);
    const customPath = settingsObj.conversionPairsFile;
    const defaultPath = './data/default_pairs.json';

    let pairs = await loadConversionPairsFromFile(customPath, context);

    if (pairs && Array.isArray(pairs)) {
        console.log(`[Kyujify] Returning ${pairs.length} pairs from custom path: ${customPath}`);
        return pairs;
    }

    if (customPath !== defaultPath) {
        vscode.window.showWarningMessage(`Failed to load conversion pairs from '${customPath}'. Falling back to default pairs.`);
        console.log(`[Kyujify] Custom path '${customPath}' failed. Falling back to default.`);
    }
    
    const defaultPairs = await loadConversionPairsFromFile(defaultPath, context);

    if (defaultPairs && Array.isArray(defaultPairs)) {
        console.log(`[Kyujify] Returning ${defaultPairs.length} pairs from default path.`);
        return defaultPairs;
    }

    vscode.window.showErrorMessage('Failed to load any conversion pairs. Please check the extension settings and file integrity.');
    console.error('[Kyujify] FATAL: Failed to load any conversion pairs.');
    return [];
}



interface KakikaeRule {
    new: string;
    old: string[];
    words: string[];
}

async function loadKakikaeRulesFromFile(filePath: string, context: vscode.ExtensionContext): Promise<KakikaeRule[] | null> {
    console.log(`[Kyujify] Attempting to load kakikae rules from: ${filePath}`);
    try {
        let resolvedPath = filePath;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceFolder = workspaceFolders[0].uri.fsPath;
            resolvedPath = resolvedPath.replace(/\${workspaceFolder}/g, workspaceFolder);
        }

        let fileUri: vscode.Uri;
        if (path.isAbsolute(resolvedPath)) {
            fileUri = vscode.Uri.file(resolvedPath);
        } else {
            fileUri = vscode.Uri.joinPath(context.extensionUri, resolvedPath);
        }

        console.log(`[Kyujify] Constructed kakikae file URI: ${fileUri.toString()}`);
        const fileContent = await vscode.workspace.fs.readFile(fileUri);
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(fileContent);
        const raw = JSON.parse(jsonString);

        if (!Array.isArray(raw)) {
            throw new Error('Kakikae file root must be an array');
        }

        const rules: KakikaeRule[] = [];
        for (const entry of raw) {
            if (!entry || typeof entry !== 'object') {continue;}
            const newChar = typeof entry.new === 'string' ? entry.new.normalize('NFC') : '';
            const oldList = Array.isArray(entry.old)
                ? entry.old
                    .filter((o: any) => typeof o === 'string' && o.length > 0)
                    .map((o: string) => o.normalize('NFC'))
                : [];
            const wordsList = Array.isArray(entry.words)
                ? entry.words
                    .filter((w: any) => typeof w === 'string' && w.length > 0)
                    .map((w: string) => w.normalize('NFC'))
                : [];
            if (!newChar || oldList.length === 0 || wordsList.length === 0) {
                continue;
            }
            rules.push({ new: newChar, old: oldList, words: wordsList });
        }

        console.log(`[Kyujify] Successfully loaded ${rules.length} kakikae rules from ${filePath}`);
        return rules;
    } catch (error: any) {
        console.error(`[Kyujify] ERROR in loadKakikaeRulesFromFile for ${filePath}:`, error);
        return null;
    }
}

function buildKakikaeMap(rules: KakikaeRule[]): Record<string, string> {
    const map: Record<string, string> = {};

    for (const rule of rules) {
        const newChar = rule.new;
        for (const wordModern of rule.words) {
            const modern = wordModern;

            let containsNew = modern.includes(newChar);

            if (containsNew) {
                for (const oldChar of rule.old) {
                    const oldWord = modern.split(newChar).join(oldChar);
                    if (oldWord !== modern) {
                        map[oldWord] = modern;
                    }
                }
            } else {
                for (const oldChar of rule.old) {
                    if (modern.includes(oldChar)) {
                        const newWord = modern.split(oldChar).join(newChar);
                        if (newWord !== modern) {
                            map[modern] = newWord;
                        }
                    }
                }
            }
        }
    }

    return map;
}

export function applyKakikae(text: string, kakikaeMap: Record<string, string>, exclusions: string[] = []): string {
    if (!kakikaeMap || Object.keys(kakikaeMap).length === 0) {
        return text;
    }

    let convertedText = text.normalize('NFC');

    const exclusionPlaceholders: { [placeholder: string]: string } = {};
    exclusions.forEach((exclusion, index) => {
        const norm = exclusion.normalize('NFC');
        if (!norm) {return;}
        if (convertedText.includes(norm)) {
            const placeholder = `__KAKIKAE_EXCLUSION_${index}__`;
            exclusionPlaceholders[placeholder] = norm;
            convertedText = convertedText.split(norm).join(placeholder);
        }
    });

    const keys = Object.keys(kakikaeMap).sort((a, b) => b.length - a.length);

    for (const from of keys) {
        const to = kakikaeMap[from];
        if (!from || !to || from === to) {continue;}
        if (convertedText.includes(from)) {
            convertedText = convertedText.split(from).join(to);
        }
    }

    Object.entries(exclusionPlaceholders).forEach(([placeholder, original]) => {
        convertedText = convertedText.split(placeholder).join(original);
    });

    return convertedText;
}

export async function getKakikaeMap(settings: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): Promise<Record<string, string>> {
    const kakikaeFile = settings.get<string>('kakikaeFile', './data/default_kakikae.json');
    const rules = await loadKakikaeRulesFromFile(kakikaeFile, context);
    if (!rules) {
        console.warn('[Kyujify] No kakikae rules loaded; Apply Kakikae will be a no-op.');
        return {};
    }
    return buildKakikaeMap(rules);
}