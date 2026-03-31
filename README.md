# Kyujify - Japanese Character Converter

[![Version](https://img.shields.io/visual-studio-marketplace/v/Ishizue.kyujify)](https://marketplace.visualstudio.com/items?itemName=Ishizue.kyujify)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/Ishizue.kyujify)](https://marketplace.visualstudio.com/items?itemName=Ishizue.kyujify)

Convert between modern Shinjitai (新字体) and historical Kyūjitai (旧字体) Japanese characters directly in VS Code.

## Features

- ➡️ Bidirectional conversion between Shinjitai and Kyūjitai
- 🎯 Convert selections or entire documents
- 🛡️ Exclusion list for protected characters/words
- ✨ Line-specific conversion using prefix symbols
- 🔁 Variant cycling command for grouped forms (e.g. 闘 ↔ 鬥 ↔ 鬪 ↔ 鬬)
- 🈺 Kakikae (代用語) command for controlled, word-specific substitutions
- 📥 450+ built-in character pairs ([source](https://github.com/DrTurnon/kyujipy/blob/master/kyujipy/data/kyujitai_simplified.cson))
- 📦 Custom pair/variant/kakikae overrides support via JSON

## Installation

1. Open **Extensions** view (`Ctrl+Shift+X`)
2. Search for "Kyujify"
3. Click **Install**
4. Reload VS Code

## Usage

**Basic Conversion:**

- Right-click menu: "Convert to Kyūjitai" / "Convert to Shinjitai"
- Command Palette (`Ctrl+Shift+P`):
  - `Kyujify: Convert to Kyūjitai`
  - `Kyujify: Convert to Shinjitai`
- Keyboard shortcuts (configure in settings)

### Variant Cycling

Use when multiple traditional/variant forms exist and you want to cycle through them interactively.

- Command Palette:
  - `Kyujify: Cycle Variants`
- Behavior:
  - If text is selected: only the selection is cycled.
  - If nothing is selected: the entire document is cycled.
  - Each Kanji belonging to a variant group is replaced with the “next” one in its group (cyclic).
- Default variant groups are defined in `./data/default_variants.json`, for example:
  - `["闘","鬥","鬪","鬬"]`
- This command does NOT change Shinjitai/Kyūjitai mappings and is independent from basic conversion.

### Kakikae (代用語) Conversion

Implements controlled [同音の漢字による書きかえ / 代用語](https://ja.wikipedia.org/wiki/%E5%90%8C%E9%9F%B3%E3%81%AE%E6%BC%A2%E5%AD%97%E3%81%AB%E3%82%88%E3%82%8B%E6%9B%B8%E3%81%8D%E3%81%8B%E3%81%88) behavior:
only specific words are rewritten from older forms to chosen modern forms.

- Command Palette:
  - `Kyujify: Apply Kakikae`
- Behavior:
  - If text is selected: applies kakikae only to the selection.
  - If nothing is selected: applies to the entire document.
  - Uses explicit rules of the form:
    - `{"new": "亜", "old": ["堊"], "words": ["白亜"]}`
  - For example (with the default rules):
    - `白堊` → `白亜`
    - `諳記` → `暗記`
- Scope and safety:
  - Rules are word-specific; there is no blanket character-wide replacement.
  - `kyujify.exclusions` are respected so protected words are not rewritten.

**Selection Rules:**

- Converts entire document when no text is selected
- Converts only selection when text is highlighted

![selection](images/selection.gif)

## Configuration

This extension contributes the following settings:

- `kyujify.conversionPairsFile`
  - Path to the JSON file containing Shinjitai–Kyūjitai pairs.
  - Default: `./data/default_pairs.json`
- `kyujify.variantsFile`
  - Path to the JSON file containing variant cycles.
  - Format: array of arrays, e.g. `[["闘","鬥","鬪","鬬"], ["広","廣"]]`
  - Used by `Kyujify: Cycle Variants`.
  - Default: `./data/default_variants.json`
- `kyujify.kakikaeFile`
  - Path to the JSON file containing kakikae (代用語) rules.
  - Format: array of objects:
    - `{"new": "亜", "old": ["堊"], "words": ["白亜"]}`
  - Used by `Kyujify: Apply Kakikae`.
  - Default: `./data/default_kakikae.json`
- `kyujify.lineStartSymbol`
  - Symbol that indicates a line should be converted.
  - When non-empty, only lines starting with this symbol are processed by basic conversion commands.
- `kyujify.exclusions`
  - List of words to exclude from all conversions (including kakikae).
  - Example: `["欠缺"]`

## Conversion Data

Default conversion pairs are based on [DrTurnon/kyujipy's kyujitai_simplified list](https://github.com/DrTurnon/kyujipy/blob/master/kyujipy/data/kyujitai_simplified.cson) (MIT licensed). Structure matches the original CSON format:

### Shinjitai ↔ Kyūjitai Pairs

Default conversion pairs are based on [DrTurnon/kyujipy's kyujitai_simplified list](https://github.com/DrTurnon/kyujipy/blob/master/kyujipy/data/kyujitai_simplified.cson) (MIT licensed). Structure matches the original CSON-style list:

```json
[
  ["亜", "亞"],
  ["悪", "惡"],
  ["圧", "壓"],
  ["囲", "圍"]
]
```

### Variant Cycles

Variant cycles are defined in `./data/default_variants.json` as arrays of related forms:

```json
[["闘", "鬥", "鬪", "鬬"]]
```

These are used only by `Kyujify: Cycle Variants` to rotate between forms. They do not affect basic Kyūjitai/Shinjitai conversion.

### Kakikae (代用語) Rules

Kakikae rules are defined in `./data/default_kakikae.json` as objects:

```json
[
  {
    "new": "亜",
    "old": ["堊"],
    "words": ["白亜"]
  },
  {
    "new": "暗",
    "old": ["諳"],
    "words": ["暗記", "暗唱", "暗譜", "暗算"]
  }
]
```

Semantics:

- Only listed `words` are targeted.
- Any matching `old`-form variant of those words is rewritten to use `new`.
- This reflects 「代用語とは、特定の熟語に限って書き換えるものである。」and avoids global character substitutions.

## Advanced Usage

### Line-Specific Conversion:

Prefix lines with your symbol to convert only those lines:

```
> 聖アレキセイ寺院の殺人事件に法水が解決を公表しなかつたので、そろ〱迷宮入りの噂が立ちはじめた十日目のこと、その日から搜査關係の主腦部は、ラザレフ殺害者の追求を放棄しなければならなくなつた。 (converted)
この書き出しから始まる『黒死館殺人事件』は、小栗虫太郎による長編探偵小説であり、日本探偵小説の「三大奇書」の一つとも称される。 (unconverted)
```

![symbol](images/symbol.gif)

### Exclusion Protection:

Preserve specific combinations during conversion:

```
// kyujify.exclusions = ["欠缺"]
欠缺 -> remains 欠缺 (instead of 欠欠 or 缺缺)
```

![exclusion](images/exclusion.gif)

## Release Notes

### 1.0.0

Initial release

### 2.0.0

#### Added

- Cycle through action for variants
- Support for kakikae conversion

## License

MIT (Conversion data derived from [kyujipy](https://github.com/DrTurnon/kyujipy) by DrTurnon, MIT licensed)
