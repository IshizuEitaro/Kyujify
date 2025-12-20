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

// Load and parse variant groups from JSON file (sibling to default_pairs.json)
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

        // Ensure all entries are arrays of strings
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

// Build map: char -> nextChar in its variant cycle
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

// Apply variant cycling to the given text using a pre-built nextVariant map
export function cycleVariantsInText(text: string, nextVariantMap: Record<string, string>): string {
    // Simple char-wise mapping; this is sufficient for Kanji variants
    let result = '';
    for (const ch of text) {
        const mapped = nextVariantMap[ch] || ch;
        result += mapped;
    }
    return result;
}

// Public helper used by the Cycle Variants command
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

    // Replace excluded words with placeholders
    exclusions.forEach((exclusion, index) => {
        if (convertedText.includes(exclusion.normalize('NFC'))) {
            const placeholder = `__EXCLUSION_${index}__`;
            const normalizedExclusion = exclusion.normalize('NFC');
            exclusionPlaceholders[placeholder] = normalizedExclusion;
            convertedText = convertedText.replaceAll(normalizedExclusion, placeholder);
        }
    });

    // Apply default conversions
    for (const [shinjitai, kyujitai] of defaultPairs) {
        const from = (to === 'kyujitai' ? shinjitai : kyujitai).normalize('NFC');
        const toChar = (to === 'kyujitai' ? kyujitai : shinjitai).normalize('NFC');
        convertedText = convertedText.split(from).join(toChar);
    }

    // Restore excluded words
    Object.entries(exclusionPlaceholders).forEach(([placeholder, original]) => {
        convertedText = convertedText.replaceAll(placeholder, original);
    });

    return convertedText;
}

async function loadConversionPairsFromFile(filePath: string, context: vscode.ExtensionContext): Promise<[string, string][] | null> {
    console.log(`[Kyujify] Attempting to load pairs from: ${filePath}`);
    try {
        // 1. Resolve VS Code variables like ${workspaceFolder}
        let resolvedPath = filePath;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspaceFolder = workspaceFolders[0].uri.fsPath;
            resolvedPath = resolvedPath.replace(/\${workspaceFolder}/g, workspaceFolder);
        }

        // 2. Determine if the path is absolute or relative
        let fileUri: vscode.Uri;
        if (path.isAbsolute(resolvedPath)) {
            fileUri = vscode.Uri.file(resolvedPath);
        } else {
            // Assume relative to extension directory for defaults or simple relative paths
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
        // Let the caller handle the error message
        return null;
    }
}

export async function getConversionPairs(settings: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): Promise<[string, string][]> {
    console.log('[Kyujify] getConversionPairs called.');
    const settingsObj = getSettings(settings);
    const customPath = settingsObj.conversionPairsFile;
    const defaultPath = './data/default_pairs.json'; // The default value from package.json

    // 1. Try loading from the user-defined path
    let pairs = await loadConversionPairsFromFile(customPath, context);

    if (pairs && Array.isArray(pairs)) {
        console.log(`[Kyujify] Returning ${pairs.length} pairs from custom path: ${customPath}`);
        return pairs;
    }

    // 2. If custom path was set and failed, show a warning.
    if (customPath !== defaultPath) {
        vscode.window.showWarningMessage(`Failed to load conversion pairs from '${customPath}'. Falling back to default pairs.`);
        console.log(`[Kyujify] Custom path '${customPath}' failed. Falling back to default.`);
    }
    
    // 3. Fallback to internal default path
    const defaultPairs = await loadConversionPairsFromFile(defaultPath, context);

    if (defaultPairs && Array.isArray(defaultPairs)) {
        console.log(`[Kyujify] Returning ${defaultPairs.length} pairs from default path.`);
        return defaultPairs;
    }

    // 4. If we've reached this point, both custom and default paths have failed.
    vscode.window.showErrorMessage('Failed to load any conversion pairs. Please check the extension settings and file integrity.');
    console.error('[Kyujify] FATAL: Failed to load any conversion pairs.');
    return [];
}