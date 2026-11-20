// Dice rolling: expressions like "1d20+5", "2d6+1d4-1", plus Pathfinder check/attack helpers.
(function () {
  'use strict';

  function die(sides) {
    if (sides < 1) return 0;
    // Unbiased integer in [1, sides] from crypto randomness.
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / sides) * sides;
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return (x % sides) + 1;
  }

  // Parse and roll an expression. Returns { total, terms, text } or throws on bad input.
  function rollExpr(expr) {
    const src = String(expr || '').replace(/\s+/g, '').toLowerCase();
    if (!src) throw new Error('Enter a dice expression such as 1d20+5');
    const re = /([+-]?)(?:(\d*)d(\d+)|(\d+))/g;
    let m, pos = 0, total = 0;
    const terms = [];
    while ((m = re.exec(src))) {
      if (m.index !== pos) throw new Error('Could not read "' + expr + '"');
      pos = re.lastIndex;
      const sgn = m[1] === '-' ? -1 : 1;
      if (m[3] !== undefined) {
        const count = Math.min(100, parseInt(m[2] || '1', 10)), sides = Math.min(1000, parseInt(m[3], 10));
        const rolls = Array.from({ length: count }, () => die(sides));
        const sum = rolls.reduce((a, b) => a + b, 0) * sgn;
        terms.push({ kind: 'dice', sign: sgn, count, sides, rolls, sum });
        total += sum;
      } else {
        const value = parseInt(m[4], 10) * sgn;
        terms.push({ kind: 'const', value });
        total += value;
      }
    }
    if (pos !== src.length || !terms.length) throw new Error('Could not read "' + expr + '"');
    return { total, terms, text: describe(terms) };
  }

  function describe(terms) {
    return terms.map((t, i) => {
      const op = i === 0 ? (t.kind === 'dice' ? (t.sign < 0 ? '-' : '') : (t.value < 0 ? '-' : '')) : ((t.kind === 'dice' ? t.sign : Math.sign(t.value) || 1) < 0 ? ' - ' : ' + ');
      if (t.kind === 'dice') return op + `${t.count}d${t.sides} [${t.rolls.join(', ')}]`;
      return op + Math.abs(t.value);
    }).join('');
  }

  function signed(n) { return (n >= 0 ? '+ ' : '- ') + Math.abs(n); }

  // A d20 check with a flat modifier.
  function check(mod) {
    const nat = die(20);
    return { nat, mod, total: nat + mod };
  }

  function critLow(crit) {
    const m = String(crit || '20').match(/(\d+)/);
    const x = m ? parseInt(m[1], 10) : 20;
    return x >= 1 && x <= 20 ? x : 20;
  }
  function critMult(mult) {
    const m = String(mult || 'x2').match(/(\d+)/);
    return m ? Math.max(2, parseInt(m[1], 10)) : 2;
  }

  // Damage: dice expression + flat bonus. On a confirmed crit, roll the dice `mult` times and multiply the bonus.
  function damage(dice, bonus, mult) {
    const times = mult || 1;
    let total = 0;
    const parts = [];
    for (let i = 0; i < times; i++) {
      if (dice) {
        const r = rollExpr(dice);
        total += r.total;
        parts.push(r.text);
      }
      total += bonus;
    }
    const text = (parts.length ? parts.join(' + ') : '') + (bonus ? ' ' + signed(bonus * times) : '');
    return { total: Math.max(dice ? 1 : 0, total), text: text.trim() || String(total) };
  }

  window.PF_DICE = { die, rollExpr, check, critLow, critMult, damage, signed };
})();
