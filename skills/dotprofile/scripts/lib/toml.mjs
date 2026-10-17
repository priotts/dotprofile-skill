/**
 * A small TOML reader: enough for the manifests the extractor reads (pyproject.toml,
 * Cargo.toml). Tables, arrays of tables, dotted keys, strings, arrays, inline tables, numbers,
 * booleans and dates (kept as strings). Throws on anything it cannot read.
 */
export function parseToml(source) {
  const root = {};
  let table = root;
  let pos = 0;

  const fail = (message) => {
    const line = source.slice(0, pos).split("\n").length;
    throw new SyntaxError(`TOML line ${line}: ${message}`);
  };
  const peek = (n = 0) => source[pos + n];
  const startsWith = (text) => source.startsWith(text, pos);
  const skipSpaces = () => {
    while (peek() === " " || peek() === "\t") pos++;
  };
  const skipComment = () => {
    if (peek() === "#") while (pos < source.length && peek() !== "\n") pos++;
  };
  /** Spaces, newlines and comments: inside arrays, where all of them may appear. */
  const skipBlank = () => {
    for (;;) {
      skipSpaces();
      skipComment();
      if (peek() === "\n" || peek() === "\r") pos++;
      else return;
    }
  };
  const endOfLine = () => {
    skipSpaces();
    skipComment();
    if (peek() === "\r") pos++;
    if (pos < source.length && peek() !== "\n") fail("expected the end of the line");
    pos++;
  };

  const key = () => {
    const parts = [];
    for (;;) {
      skipSpaces();
      if (peek() === '"' || peek() === "'") parts.push(string());
      else {
        const match = /^[A-Za-z0-9_-]+/.exec(source.slice(pos));
        if (!match) fail("expected a key");
        parts.push(match[0]);
        pos += match[0].length;
      }
      skipSpaces();
      if (peek() !== ".") return parts;
      pos++;
    }
  };

  const descend = (base, parts) => {
    let node = base;
    for (const part of parts) {
      if (node[part] === undefined) node[part] = {};
      node = node[part];
      if (Array.isArray(node)) node = node[node.length - 1];
      if (typeof node !== "object" || node === null) fail(`${part} is not a table`);
    }
    return node;
  };

  const string = () => {
    if (startsWith('"""') || startsWith("'''")) {
      const quote = source.slice(pos, pos + 3);
      pos += 3;
      if (peek() === "\n") pos++;
      const end = source.indexOf(quote, pos);
      if (end < 0) fail("unterminated string");
      const raw = source.slice(pos, end);
      pos = end + 3;
      return quote === '"""' ? unescape(raw.replace(/\\\r?\n\s*/g, "")) : raw;
    }
    const quote = peek();
    pos++;
    let raw = "";
    while (peek() !== quote) {
      if (pos >= source.length || peek() === "\n") fail("unterminated string");
      if (quote === '"' && peek() === "\\") {
        raw += source.slice(pos, pos + 2);
        pos += 2;
      } else raw += source[pos++];
    }
    pos++;
    return quote === '"' ? unescape(raw) : raw;
  };

  const unescape = (raw) =>
    raw.replace(/\\(u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|.)/g, (_, code) => {
      const simple = { b: "\b", t: "\t", n: "\n", f: "\f", r: "\r", '"': '"', "\\": "\\" };
      if (code.length > 1) return String.fromCodePoint(parseInt(code.slice(1), 16));
      if (simple[code] === undefined) fail(`unknown escape \\${code}`);
      return simple[code];
    });

  const value = () => {
    skipSpaces();
    const c = peek();
    if (c === '"' || c === "'") return string();
    if (c === "[") {
      pos++;
      const items = [];
      for (;;) {
        skipBlank();
        if (peek() === "]") {
          pos++;
          return items;
        }
        items.push(value());
        skipBlank();
        if (peek() === ",") pos++;
        else if (peek() !== "]") fail("expected , or ] in an array");
      }
    }
    if (c === "{") {
      pos++;
      const inline = {};
      skipSpaces();
      if (peek() === "}") {
        pos++;
        return inline;
      }
      for (;;) {
        const parts = key();
        if (peek() !== "=") fail("expected =");
        pos++;
        const target = descend(inline, parts.slice(0, -1));
        target[parts[parts.length - 1]] = value();
        skipSpaces();
        if (peek() === ",") pos++;
        else if (peek() === "}") {
          pos++;
          return inline;
        } else fail("expected , or } in an inline table");
      }
    }
    if (startsWith("true")) return (pos += 4), true;
    if (startsWith("false")) return (pos += 5), false;
    const match = /^[0-9A-Za-z_+\-.:]+(?:[ T][0-9:.]+(?:Z|[+-][0-9:]+)?)?/.exec(source.slice(pos));
    if (!match) fail("expected a value");
    pos += match[0].length;
    const text = match[0];
    if (/^[+-]?\d[\d_]*$/.test(text)) return Number(text.replace(/_/g, ""));
    if (/^[+-]?\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?$/.test(text)) return Number(text.replace(/_/g, ""));
    return text;
  };

  while (pos < source.length) {
    skipBlank();
    if (pos >= source.length) break;
    if (startsWith("[[")) {
      pos += 2;
      const parts = key();
      if (!startsWith("]]")) fail("expected ]]");
      pos += 2;
      const parent = descend(root, parts.slice(0, -1));
      const name = parts[parts.length - 1];
      if (parent[name] === undefined) parent[name] = [];
      if (!Array.isArray(parent[name])) fail(`${name} is not an array of tables`);
      table = {};
      parent[name].push(table);
    } else if (peek() === "[") {
      pos++;
      const parts = key();
      if (peek() !== "]") fail("expected ]");
      pos++;
      table = descend(root, parts);
    } else {
      const parts = key();
      if (peek() !== "=") fail("expected =");
      pos++;
      const target = descend(table, parts.slice(0, -1));
      target[parts[parts.length - 1]] = value();
    }
    endOfLine();
  }
  return root;
}
