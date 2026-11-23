type Token =
  | { type: 'number'; value: number }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9.,]/.test(ch)) {
      let rawNum = '';
      let dotCount = 0;
      while (i < input.length && /[0-9.,]/.test(input[i])) {
        const c = input[i];
        if (c === ',') {
          i++;
          continue;
        }
        if (c === '.') {
          dotCount++;
          if (dotCount > 1) {
            throw new Error('Invalid decimal number');
          }
        }
        rawNum += c;
        i++;
      }
      if (!rawNum || rawNum === '.') {
        throw new Error('Incomplete number');
      }
      const parsed = Number(rawNum);
      if (!Number.isFinite(parsed)) {
        throw new Error('Number out of range');
      }
      tokens.push({ type: 'number', value: parsed });
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: ${ch}`);
  }

  return tokens;
}

export function evaluateMathExpression(expr: string): number | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;

  try {
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) return null;

    let pos = 0;

    const peek = (): Token | undefined => tokens[pos];
    const consume = (): Token | undefined => tokens[pos++];

    const parseExpression = (): number => {
      let value = parseTerm();
      while (true) {
        const next = peek();
        if (next && next.type === 'op' && (next.value === '+' || next.value === '-')) {
          consume();
          const right = parseTerm();
          value = next.value === '+' ? value + right : value - right;
        } else {
          break;
        }
      }
      return value;
    };

    const parseTerm = (): number => {
      let value = parseUnary();
      while (true) {
        const next = peek();
        if (next && next.type === 'op' && (next.value === '*' || next.value === '/')) {
          consume();
          const right = parseUnary();
          if (next.value === '/') {
            if (right === 0) throw new Error('Division by zero');
            value = value / right;
          } else {
            value = value * right;
          }
        } else {
          break;
        }
      }
      return value;
    };

    const parseUnary = (): number => {
      const next = peek();
      if (next && next.type === 'op' && (next.value === '+' || next.value === '-')) {
        consume();
        const operand = parseUnary();
        return next.value === '-' ? -operand : operand;
      }
      return parsePrimary();
    };

    const parsePrimary = (): number => {
      const next = consume();
      if (!next) throw new Error('Unexpected end of expression');

      if (next.type === 'number') {
        return next.value;
      }

      if (next.type === 'lparen') {
        const inner = parseExpression();
        const closing = consume();
        if (!closing || closing.type !== 'rparen') {
          throw new Error('Missing closing parenthesis');
        }
        return inner;
      }

      throw new Error('Unexpected token');
    };

    const result = parseExpression();
    if (pos !== tokens.length || !Number.isFinite(result)) {
      return null;
    }

    // Mitigate IEEE-754 floating-point noise like 0.1 + 0.2 = 0.30000000000000004
    return Math.round(result * 1e10) / 1e10;
  } catch {
    return null;
  }
}