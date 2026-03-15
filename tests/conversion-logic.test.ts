import { describe, it, expect } from 'vitest';
import {
    convertText,
    cycleVariantsInText,
    applyKakikae,
    buildNextVariantMap,
    buildKakikaeMap,
    KakikaeRule
} from '../src/core/conversion-logic';

describe('conversion-logic', () => {
    const defaultPairs: [string, string][] = [
        ['国', '國'],
        ['学', '學'],
        ['体', '體']
    ];

    describe('convertText', () => {
        it('converts to Kyujitai', () => {
            const result = convertText('国の学体', 'kyujitai', defaultPairs);
            expect(result).toBe('國の學體');
        });

        it('converts to Shinjitai', () => {
            const result = convertText('國の學體', 'shinjitai', defaultPairs);
            expect(result).toBe('国の学体');
        });

        it('respects exclusions (kyujify)', () => {
            const result = convertText('国の学体', 'kyujitai', defaultPairs, ['学']);
            expect(result).toBe('國の学體');
        });

        it('respects multi-character exclusions (shinjify)', () => {
            const result = convertText('欠缺', 'shinjitai', defaultPairs, ['欠缺']);
            expect(result).toBe('欠缺');
        });

        it('respects line start symbols', () => {
            const text = '国の学体\n#国の学体\n国の学体';
            const result = convertText(text, 'kyujitai', defaultPairs, [], '#');
            expect(result).toBe('国の学体\n#國の學體\n国の学体');
        });

        it('handles no symbols', () => {
            const text = '国の学体\n#国の学体\n国の学体';
            const result = convertText(text, 'kyujitai', defaultPairs, [], '');
            expect(result).toBe('國の學體\n#國の學體\n國の學體');
        });

        it('handles multi-character pairs', () => {
            const pairs: [string, string][] = [['学校', '學校']];
            const result = convertText('学校に行く', 'kyujitai', pairs);
            expect(result).toBe('學校に行く');
        });

        it('handles no match', () => {            
            const result = convertText('あいうえお', 'kyujitai', defaultPairs);
            expect(result).toBe('あいうえお');
        }); 
    });

    describe('cycleVariantsInText', () => {
        it('cycles variants according to map', () => {
            const nextMap = {
                '闘': '鬥',
                '鬥': '鬪',
                '鬪': '鬬',
                '鬬': '闘'
            };
            expect(cycleVariantsInText('闘', nextMap)).toBe('鬥');
            expect(cycleVariantsInText('鬥', nextMap)).toBe('鬪');
            expect(cycleVariantsInText('鬪', nextMap)).toBe('鬬');
            expect(cycleVariantsInText('鬬', nextMap)).toBe('闘');
            expect(cycleVariantsInText('漢字', nextMap)).toBe('漢字');
        });

        it('respects line start symbols', () => {
            const nextMap = { '闘': '鬥' };
            const text = '闘\n#闘\n闘';
            expect(cycleVariantsInText(text, nextMap, '#')).toBe('闘\n#鬥\n闘');
        });
    });

    describe('buildNextVariantMap', () => {
        it('builds a circular map from groups', () => {
            const groups = [['闘', '鬥', '鬪', '鬬']];
            const map = buildNextVariantMap(groups);
            expect(map['闘']).toBe('鬥');
            expect(map['鬥']).toBe('鬪');
            expect(map['鬪']).toBe('鬬');
            expect(map['鬬']).toBe('闘');
        });

        it('handles multiple groups without interference', () => {
        const groups = [['闘', '鬥', '鬪', '鬬'], ['斎', '齋', '齊']];
        const map = buildNextVariantMap(groups);
        expect(map['闘']).toBe('鬥');
        expect(map['斎']).toBe('齋');
        });
    });

    describe('applyKakikae', () => {
        const kakikaeMap = {
            '連繋': '連係',
            '聯繋': '連係' 
        };

        it('applies kakikae rules', () => {
            expect(applyKakikae('連繋している', kakikaeMap)).toBe('連係している');
            expect(applyKakikae('繋索する', kakikaeMap)).toBe('繋索する');
        });

        it('applies kakikae rules to multiple occurrences', () => {
            expect(applyKakikae('連繋と聯繋', kakikaeMap)).toBe('連係と連係');
        });

        it('handles multiple replacements in the same word (toShinjitai)', () => {
            const rules: KakikaeRule[] = [
                {
                    new: '係',
                    old: ['繋'],
                    words: ['連係']
                },
                {
                    new: '連',
                    old: ['聯'],
                    words: ['連係']
                }
            ];
            const map = buildKakikaeMap(rules, 'toShinjitai');
            expect(map['聯繋']).toBe('連係');
        });

        it('respects exclusions in kakikae', () => {
            expect(applyKakikae('連繋している', kakikaeMap, ['連繋'])).toBe('連繋している');
        });

        it('respects line start symbols', () => {
            const text = '連繋\n#連繋\n連繋';
            expect(applyKakikae(text, kakikaeMap, [], '#')).toBe('連繋\n#連係\n連繋');
        });
    });

    describe('buildKakikaeMap', () => {
        it('builds a map from rules (modern to old)', () => {
            const rules: KakikaeRule[] = [
                {
                    new: '双',
                    old: ['雙'],
                    words: ['双数']
                }
            ];
            const map = buildKakikaeMap(rules, 'toKyujitai');
            expect(map['双数']).toBe('雙数');
        });

        it('handles multiple replacements in the same word', () => {
            const rules: KakikaeRule[] = [
                {
                    new: '係',
                    old: ['繋'],
                    words: ['連係']
                },
                {
                    new: '連',
                    old: ['聯'],
                    words: ['連係']
                }
            ];
            const map = buildKakikaeMap(rules, 'toKyujitai');
            // '連係' should be '聯繋' after both rules are applied
            expect(map['連係']).toBe('聯繋');
        });
        });
        });

