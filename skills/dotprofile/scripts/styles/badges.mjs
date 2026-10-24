/**
 * Shields.io badges for the README body. A badge is only an image URL built from the facts:
 * building it is pure, and the viewer's browser is what loads it.
 */

/** Brand color and simple-icons slug per technology. Unknown ones get a neutral badge. */
const BRANDS = {
  Angular: ["dd0031", "angular"], Astro: ["bc52ee", "astro"], "C#": ["512bd4", "dotnet"],
  "C++": ["00599c", "cplusplus"], C: ["a8b9cc", "c"], Dart: ["0175c2", "dart"],
  "discord.js": ["5865f2", "discord"], Django: ["092e20", "django"], Docker: ["2496ed", "docker"],
  Electron: ["47848f", "electron"], Elixir: ["4b275f", "elixir"], Express: ["404d59", "express"],
  FastAPI: ["009688", "fastapi"], Flask: ["3b8eb3", "flask"], Go: ["00add8", "go"],
  grammY: ["009dca", "telegram"], HTML: ["e34f26", "html5"], Java: ["b07219", "openjdk"],
  JavaScript: ["f7df1e", "javascript", "000000"], Kotlin: ["7f52ff", "kotlin"],
  Laravel: ["ff2d20", "laravel"], "Next.js": ["000000", "nextdotjs"], NestJS: ["e0234e", "nestjs"],
  Nuxt: ["00dc82", "nuxtdotjs"], PHP: ["777bb4", "php"], Prisma: ["2d3748", "prisma"],
  Python: ["3776ab", "python"], PyTorch: ["ee4c2c", "pytorch"], Rails: ["d30001", "rubyonrails"],
  React: ["149eca", "react"], Ruby: ["cc342d", "ruby"], Rust: ["000000", "rust"],
  Svelte: ["ff3e00", "svelte"], Swift: ["f05138", "swift"], "Tailwind CSS": ["06b6d4", "tailwindcss"],
  Telegraf: ["26a5e4", "telegram"], TypeORM: ["fe0803", "typeorm"], TypeScript: ["3178c6", "typescript"],
  Vue: ["4fc08d", "vuedotjs"],
};

/** Shields.io escapes: `-` and `_` are separators, so they are doubled. */
const part = (text) => encodeURIComponent(text.replace(/-/g, "--").replace(/_/g, "__"));

/** A one-part badge for a technology, in its brand color. */
export function techBadge(name) {
  const [color, logo, logoColor = "white"] = BRANDS[name] ?? ["555555"];
  const icon = logo ? `&logo=${logo}&logoColor=${logoColor}` : "";
  return `![${name}](https://img.shields.io/badge/${part(name)}-${color}?style=flat-square${icon})`;
}

/** A label and value badge, green when at least half of the repositories have it. */
export function countBadge(label, value, ratio) {
  const color = ratio >= 0.5 ? "3fb950" : "d29922";
  return `![${label}: ${value}](https://img.shields.io/badge/${part(label)}-${part(value)}-${color}?style=flat-square)`;
}
