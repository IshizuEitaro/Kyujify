export function convertText(
    text: string,
    to: 'kyujitai' | 'shinjitai',
    defaultPairs: [string, string][],
    exclusions: string[] = [],
    symbol: string = ''
): string {
    if (symbol) {
        const lines = text.split('\n');
        const convertedLines = lines.map(line => {
            if (line.startsWith(symbol)) {
                const trimmedLine = line.slice(symbol.length);
                return symbol + convertLine(trimmedLine, to, defaultPairs, exclusions);
            }
            return line;
        });
        return convertedLines.join('\n');
    } else {
        return convertLine(text, to, defaultPairs, exclusions);
    }
}

export function convertLine(
    text: string,
    to: 'kyujitai' | 'shinjitai',
    defaultPairs: [string, string][],
    exclusions: string[]
): string {
    let convertedText = text.normalize('NFC');
    const exclusionPlaceholders: { [key: string]: string } = {};

    exclusions.forEach((exclusion, index) => {
        const normExclusion = exclusion.normalize('NFC');
        if (convertedText.includes(normExclusion)) {
            const placeholder = `__EXCLUSION_${index}__`;
            exclusionPlaceholders[placeholder] = normExclusion;
            convertedText = convertedText.replaceAll(normExclusion, placeholder);
        }
    });

    // Sort pairs by length of the 'from' string (longest first) to prevent partial matches
    const sortedPairs = [...defaultPairs].sort((a, b) => {
        const fromA = (to === 'kyujitai' ? a[0] : a[1]).length;
        const fromB = (to === 'kyujitai' ? b[0] : b[1]).length;
        return fromB - fromA;
    });

    for (const [shinjitai, kyujitai] of sortedPairs) {
        const from = (to === 'kyujitai' ? shinjitai : kyujitai).normalize('NFC');
        const toChar = (to === 'kyujitai' ? kyujitai : shinjitai).normalize('NFC');
        if (from && from !== toChar) {
            convertedText = convertedText.split(from).join(toChar);
        }
    }

    Object.entries(exclusionPlaceholders).forEach(([placeholder, original]) => {
        convertedText = convertedText.replaceAll(placeholder, original);
    });

    return convertedText;
}

export function cycleVariantsInText(text: string, nextVariantMap: Record<string, string>, symbol: string = ''): string {
    if (symbol) {
        const lines = text.split('\n');
        const convertedLines = lines.map(line => {
            if (line.startsWith(symbol)) {
                const trimmedLine = line.slice(symbol.length);
                return symbol + cycleVariantsInternal(trimmedLine, nextVariantMap);
            }
            return line;
        });
        return convertedLines.join('\n');
    } else {
        return cycleVariantsInternal(text, nextVariantMap);
    }
}

function cycleVariantsInternal(text: string, nextVariantMap: Record<string, string>): string {
    let result = '';
    for (const ch of text) {
        const mapped = nextVariantMap[ch] || ch;
        result += mapped;
    }
    return result;
}

export function buildNextVariantMap(variantGroups: string[][]): Record<string, string> {
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

export interface KakikaeRule {
    readonly new: string;
    readonly old: readonly string[];
    readonly words: readonly string[];
}

export function buildKakikaeMap(rules: KakikaeRule[], direction: 'toShinjitai' | 'toKyujitai' = 'toShinjitai'): Record<string, string> {
    const map: Record<string, string> = {};
    const wordReplacements: Record<string, string> = {};

    for (const rule of rules) {
        const newChar = rule.new;
        for (const wordModern of rule.words) {
            const modern = wordModern;

            if (direction === 'toShinjitai') {
                // Default Kakikae: Old characters -> Modern replacements
                for (const oldChar of rule.old) {
                    if (modern.includes(oldChar)) {
                        let replaced = wordReplacements[modern] || modern;
                        while (replaced.includes(oldChar)) {
                            replaced = replaced.split(oldChar).join(newChar);
                        }
                        if (replaced !== modern) {
                            wordReplacements[modern] = replaced;
                        }
                    } else if (modern.includes(newChar)) {
                        // Handle cases where modern word is the target of another rule
                        let source = modern;
                        while (source.includes(newChar)) {
                            source = source.split(newChar).join(oldChar);
                        }
                        if (source !== modern) {
                            wordReplacements[source] = wordReplacements[source] || modern;
                        }
                    }
                }
            } else {
                // Reverse Kakikae: Modern replacements -> Old characters
                for (const oldChar of rule.old) {
                    if (modern.includes(newChar)) {
                        let replaced = wordReplacements[modern] || modern;
                        while (replaced.includes(newChar)) {
                            replaced = replaced.split(newChar).join(oldChar);
                        }
                        if (replaced !== modern) {
                            wordReplacements[modern] = replaced;
                        }
                    } else if (modern.includes(oldChar)) {
                        let source = modern;
                        while (source.includes(oldChar)) {
                            source = source.split(oldChar).join(newChar);
                        }
                        if (source !== modern) {
                            wordReplacements[source] = wordReplacements[source] || modern;
                        }
                    }
                }
            }
        }
    }

    return wordReplacements;
}

export function applyKakikae(text: string, kakikaeMap: Record<string, string>, exclusions: string[] = [], symbol: string = ''): string {
    if (symbol) {
        const lines = text.split('\n');
        const convertedLines = lines.map(line => {
            if (line.startsWith(symbol)) {
                const trimmedLine = line.slice(symbol.length);
                return symbol + applyKakikaeInternal(trimmedLine, kakikaeMap, exclusions);
            }
            return line;
        });
        return convertedLines.join('\n');
    } else {
        return applyKakikaeInternal(text, kakikaeMap, exclusions);
    }
}

function applyKakikaeInternal(text: string, kakikaeMap: Record<string, string>, exclusions: string[] = []): string {
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
