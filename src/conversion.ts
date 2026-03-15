import * as vscode from 'vscode';
import * as path from 'path';
import { getSettings } from './settings';
import {
    convertText as coreConvertText,
    cycleVariantsInText as coreCycleVariantsInText,
    applyKakikae as coreApplyKakikae,
    buildNextVariantMap,
    buildKakikaeMap,
    KakikaeRule
} from './core/conversion-logic';

export function convertText(text: string, to: 'kyujitai' | 'shinjitai', defaultPairs: [string, string][], exclusions: string[] = [], symbol: string = ''): string {
    return coreConvertText(text, to, defaultPairs, exclusions, symbol);
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

export function cycleVariantsInText(text: string, nextVariantMap: Record<string, string>): string {
    return coreCycleVariantsInText(text, nextVariantMap);
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
            rules.push({ new: newChar, old: oldList, words: wordsList } as KakikaeRule);
        }

        console.log(`[Kyujify] Successfully loaded ${rules.length} kakikae rules from ${filePath}`);
        return rules;
    } catch (error: any) {
        console.error(`[Kyujify] ERROR in loadKakikaeRulesFromFile for ${filePath}:`, error);
        return null;
    }
}

export function applyKakikae(text: string, kakikaeMap: Record<string, string>, exclusions: string[] = []): string {
    return coreApplyKakikae(text, kakikaeMap, exclusions);
}

export async function getKakikaeMap(settings: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext, direction: 'toShinjitai' | 'toKyujitai' = 'toShinjitai'): Promise<Record<string, string>> {
    const kakikaeFile = settings.get<string>('kakikaeFile', './data/default_kakikae.json');
    const rules = await loadKakikaeRulesFromFile(kakikaeFile, context);
    if (!rules) {
        console.warn('[Kyujify] No kakikae rules loaded; Apply Kakikae will be a no-op.');
        return {};
    }
    return buildKakikaeMap(rules, direction);
}
