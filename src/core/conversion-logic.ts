function makeUniquePlaceholder(prefix: string, index: number, text: string): string {
  let token = `\uE000${prefix}_${index}\uE001`;
  while (text.includes(token)) {
    token += "\uE002";
  }
  return token;
}

export function convertText(
  text: string,
  to: "kyujitai" | "shinjitai",
  defaultPairs: [string, string][],
  exclusions: string[] = [],
  symbol: string = "",
): string {
  if (symbol) {
    const lines = text.split("\n");
    const convertedLines = lines.map((line) => {
      if (line.startsWith(symbol)) {
        const trimmedLine = line.slice(symbol.length);
        return symbol + convertLine(trimmedLine, to, defaultPairs, exclusions);
      }
      return line;
    });
    return convertedLines.join("\n");
  } else {
    return convertLine(text, to, defaultPairs, exclusions);
  }
}

export function convertLine(
  text: string,
  to: "kyujitai" | "shinjitai",
  defaultPairs: [string, string][],
  exclusions: string[],
): string {
  let convertedText = text.normalize("NFC");
  const exclusionPlaceholders: { [key: string]: string } = {};

  // Sort exclusions by length (longest first) to prevent shorter exclusions from partially masking longer ones
  const sortedExclusions = [...exclusions]
    .map((e) => e.normalize("NFC"))
    .filter((e) => e.length > 0)
    .sort((a, b) => b.length - a.length);

  sortedExclusions.forEach((normExclusion, index) => {
    if (convertedText.includes(normExclusion)) {
      const placeholder = makeUniquePlaceholder("EXCLUSION", index, convertedText);
      exclusionPlaceholders[placeholder] = normExclusion;
      convertedText = convertedText.replaceAll(normExclusion, placeholder);
    }
  });

  // Sort pairs by length of the 'from' string (longest first) to prevent partial matches
  const sortedPairs = [...defaultPairs].sort((a, b) => {
    const fromA = (to === "kyujitai" ? a[0] : a[1]).length;
    const fromB = (to === "kyujitai" ? b[0] : b[1]).length;
    return fromB - fromA;
  });

  for (const [shinjitai, kyujitai] of sortedPairs) {
    const from = (to === "kyujitai" ? shinjitai : kyujitai).normalize("NFC");
    const toChar = (to === "kyujitai" ? kyujitai : shinjitai).normalize("NFC");
    if (from && from !== toChar) {
      convertedText = convertedText.split(from).join(toChar);
    }
  }

  Object.entries(exclusionPlaceholders).forEach(([placeholder, original]) => {
    convertedText = convertedText.replaceAll(placeholder, original);
  });

  return convertedText;
}

export function cycleVariantsInText(
  text: string,
  nextVariantMap: Record<string, string>,
  symbol: string = "",
): string {
  if (symbol) {
    const lines = text.split("\n");
    const convertedLines = lines.map((line) => {
      if (line.startsWith(symbol)) {
        const trimmedLine = line.slice(symbol.length);
        return symbol + cycleVariantsInternal(trimmedLine, nextVariantMap);
      }
      return line;
    });
    return convertedLines.join("\n");
  } else {
    return cycleVariantsInternal(text, nextVariantMap);
  }
}

function cycleVariantsInternal(text: string, nextVariantMap: Record<string, string>): string {
  let result = "";
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

export function buildKakikaeMap(
  rules: KakikaeRule[],
  direction: "toShinjitai" | "toKyujitai" = "toShinjitai",
): Record<string, string> {
  const wordReplacements: Record<string, string> = {};

  if (direction === "toShinjitai") {
    for (const rule of rules) {
      for (const modern of rule.words) {
        // Scope old character lookups to only rules whose words array includes the current word
        const applicableRules = rules.filter((r) => r.words.includes(modern));
        const wordSpecificDirectRules: Record<string, string[]> = {};
        for (const ar of applicableRules) {
          wordSpecificDirectRules[ar.new] = wordSpecificDirectRules[ar.new] || [];
          wordSpecificDirectRules[ar.new].push(...ar.old);
        }

        // For a modern word like "連係", generate ALL possible older versions
        // by replacing each modern character with its potential old counterparts.
        const sources = [modern];
        let changed = true;
        while (changed) {
          changed = false;
          const currentSources = [...sources];
          for (const source of currentSources) {
            for (const newChar in wordSpecificDirectRules) {
              if (source.includes(newChar)) {
                for (const oldChar of wordSpecificDirectRules[newChar]) {
                  const nextSource = source.split(newChar).join(oldChar);
                  if (!sources.includes(nextSource)) {
                    sources.push(nextSource);
                    wordReplacements[nextSource] = modern;
                    changed = true;
                  }
                }
              }
            }
          }
        }

        // Also handle the case where modern word itself contains old characters
        for (const oldChar of rule.old) {
          if (modern.includes(oldChar)) {
            const replacement = modern.split(oldChar).join(rule.new);
            wordReplacements[modern] = replacement;
          }
        }
      }
    }
  } else {
    // Reverse Kakikae: Modern words -> Old versions
    for (const rule of rules) {
      for (const modern of rule.words) {
        for (const oldChar of rule.old) {
          if (modern.includes(rule.new)) {
            const target = modern;
            const existing = wordReplacements[target] || target;
            const replacement = existing.split(rule.new).join(oldChar);
            if (replacement !== target) {
              wordReplacements[target] = replacement;
            }
          }
        }
      }
    }
  }

  return wordReplacements;
}

export function applyKakikae(
  text: string,
  kakikaeMap: Record<string, string>,
  exclusions: string[] = [],
  symbol: string = "",
): string {
  if (symbol) {
    const lines = text.split("\n");
    const convertedLines = lines.map((line) => {
      if (line.startsWith(symbol)) {
        const trimmedLine = line.slice(symbol.length);
        return symbol + applyKakikaeInternal(trimmedLine, kakikaeMap, exclusions);
      }
      return line;
    });
    return convertedLines.join("\n");
  } else {
    return applyKakikaeInternal(text, kakikaeMap, exclusions);
  }
}

function applyKakikaeInternal(
  text: string,
  kakikaeMap: Record<string, string>,
  exclusions: string[] = [],
): string {
  if (!kakikaeMap || Object.keys(kakikaeMap).length === 0) {
    return text;
  }

  let convertedText = text.normalize("NFC");

  const exclusionPlaceholders: { [placeholder: string]: string } = {};
  const sortedExclusions = [...exclusions]
    .map((e) => e.normalize("NFC"))
    .filter((e) => e.length > 0)
    .sort((a, b) => b.length - a.length);

  sortedExclusions.forEach((norm, index) => {
    if (convertedText.includes(norm)) {
      const placeholder = makeUniquePlaceholder("KAKIKAE_EXCLUSION", index, convertedText);
      exclusionPlaceholders[placeholder] = norm;
      convertedText = convertedText.split(norm).join(placeholder);
    }
  });

  const keys = Object.keys(kakikaeMap).sort((a, b) => b.length - a.length);

  for (const from of keys) {
    const to = kakikaeMap[from];
    if (!from || !to || from === to) {
      continue;
    }
    if (convertedText.includes(from)) {
      convertedText = convertedText.split(from).join(to);
    }
  }

  Object.entries(exclusionPlaceholders).forEach(([placeholder, original]) => {
    convertedText = convertedText.split(placeholder).join(original);
  });

  return convertedText;
}
