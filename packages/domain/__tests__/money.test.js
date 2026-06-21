"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const money_js_1 = require("../src/money.js");
(0, vitest_1.describe)('money', () => {
    (0, vitest_1.it)('cents rejeita nao-inteiro', () => {
        (0, vitest_1.expect)(() => (0, money_js_1.cents)(1.5)).toThrow();
    });
    (0, vitest_1.it)('cents rejeita negativo', () => {
        (0, vitest_1.expect)(() => (0, money_js_1.cents)(-1)).toThrow();
    });
    (0, vitest_1.it)('addCents soma em centavos sem float drift', () => {
        const sum = (0, money_js_1.addCents)((0, money_js_1.cents)(1), (0, money_js_1.cents)(2));
        (0, vitest_1.expect)(sum).toBe(3);
    });
    (0, vitest_1.it)('subCents recusa resultado negativo', () => {
        (0, vitest_1.expect)(() => (0, money_js_1.subCents)((0, money_js_1.cents)(1), (0, money_js_1.cents)(2))).toThrow();
    });
    (0, vitest_1.it)('roundHalfEven arredonda 0.5 para par', () => {
        (0, vitest_1.expect)((0, money_js_1.roundHalfEven)(0.5)).toBe(0);
        (0, vitest_1.expect)((0, money_js_1.roundHalfEven)(1.5)).toBe(2);
        (0, vitest_1.expect)((0, money_js_1.roundHalfEven)(2.5)).toBe(2);
        (0, vitest_1.expect)((0, money_js_1.roundHalfEven)(2.4)).toBe(2);
        (0, vitest_1.expect)((0, money_js_1.roundHalfEven)(2.6)).toBe(3);
    });
    (0, vitest_1.it)('fromBrl converte string para centavos', () => {
        (0, vitest_1.expect)((0, money_js_1.fromBrl)('R$ 1.234,56')).toBe(123456);
        (0, vitest_1.expect)((0, money_js_1.fromBrl)('10')).toBe(1000);
    });
    (0, vitest_1.it)('formatBrl renderiza com locale pt-BR', () => {
        (0, vitest_1.expect)((0, money_js_1.formatBrl)((0, money_js_1.cents)(123456))).toBe('R$ 1.234,56');
    });
});
//# sourceMappingURL=money.test.js.map