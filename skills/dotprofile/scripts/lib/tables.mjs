/**
 * Lookup tables used by extraction. To recognise a new language or framework, add a line.
 */

/**
 * Programming and markup languages, by file extension. Data and prose formats (JSON, YAML,
 * Markdown, notebooks) are left out on purpose, as GitHub does: they say nothing about the
 * language a project is written in.
 */
export const EXTENSIONS = {
  astro: "Astro", bash: "Shell", c: "C", cc: "C++", cjs: "JavaScript", clj: "Clojure",
  cpp: "C++", cs: "C#", css: "CSS", cts: "TypeScript", cxx: "C++", dart: "Dart",
  erl: "Erlang", ex: "Elixir", exs: "Elixir", fs: "F#", go: "Go", groovy: "Groovy", h: "C",
  hh: "C++", hpp: "C++", hs: "Haskell", htm: "HTML", html: "HTML", java: "Java", jl: "Julia",
  js: "JavaScript", jsx: "JavaScript", kt: "Kotlin", kts: "Kotlin", less: "Less", lua: "Lua",
  mjs: "JavaScript", ml: "OCaml", mts: "TypeScript", nim: "Nim", nix: "Nix", php: "PHP",
  pl: "Perl", ps1: "PowerShell", py: "Python", rb: "Ruby", rs: "Rust", sass: "Sass",
  scala: "Scala", scss: "SCSS", sh: "Shell", svelte: "Svelte", swift: "Swift", tf: "HCL",
  ts: "TypeScript", tsx: "TypeScript", vue: "Vue", zig: "Zig", zsh: "Shell",
};

/** Languages recognised by file name rather than extension. */
export const FILE_NAMES = { Dockerfile: "Dockerfile", Containerfile: "Dockerfile", Makefile: "Makefile" };

/** Dependencies and build output committed to a repository: not the author's code. */
export const EXCLUDED_DIRECTORIES = new Set(["node_modules", "vendor", "dist", "build"]);

/**
 * Dependency → framework, per ecosystem. Only packages that define what a project is (an
 * application framework, a UI library, a game engine…) belong here, not utilities.
 */
export const FRAMEWORKS = {
  npm: {
    "@angular/core": "Angular", "@builder.io/qwik": "Qwik", "@docusaurus/core": "Docusaurus",
    "@nestjs/core": "NestJS", "@prisma/client": "Prisma", "@remix-run/react": "Remix",
    "@sveltejs/kit": "SvelteKit", "@tauri-apps/api": "Tauri", astro: "Astro",
    "discord.js": "discord.js", electron: "Electron", "ember-source": "Ember", expo: "Expo",
    express: "Express", fastify: "Fastify", gatsby: "Gatsby", grammy: "grammY", hono: "Hono",
    jquery: "jQuery", koa: "Koa", lit: "Lit", next: "Next.js", nuxt: "Nuxt", preact: "Preact",
    react: "React", "react-native": "React Native", "solid-js": "Solid", svelte: "Svelte",
    tailwindcss: "Tailwind CSS", telegraf: "Telegraf", three: "three.js", typeorm: "TypeORM",
    vitepress: "VitePress", vue: "Vue",
  },
  pypi: {
    aiohttp: "aiohttp", celery: "Celery", click: "Click", django: "Django", fastapi: "FastAPI",
    flask: "Flask", gradio: "Gradio", jax: "JAX", keras: "Keras", kivy: "Kivy",
    langchain: "LangChain", pygame: "Pygame", pyramid: "Pyramid", pyside6: "Qt", pyqt6: "Qt",
    "pytorch-lightning": "PyTorch Lightning", "scikit-learn": "scikit-learn", scrapy: "Scrapy",
    starlette: "Starlette", streamlit: "Streamlit", tensorflow: "TensorFlow",
    textual: "Textual", torch: "PyTorch", tornado: "Tornado", typer: "Typer",
  },
  go: {
    "fyne.io/fyne": "Fyne", "github.com/charmbracelet/bubbletea": "Bubble Tea",
    "github.com/gin-gonic/gin": "Gin", "github.com/go-chi/chi": "chi",
    "github.com/gofiber/fiber": "Fiber", "github.com/gorilla/mux": "Gorilla Mux",
    "github.com/labstack/echo": "Echo", "github.com/spf13/cobra": "Cobra",
    "github.com/urfave/cli": "urfave/cli", "github.com/wailsapp/wails": "Wails",
    "google.golang.org/grpc": "gRPC", "gorm.io/gorm": "GORM",
  },
  cargo: {
    "actix-web": "Actix Web", axum: "Axum", bevy: "Bevy", clap: "clap", dioxus: "Dioxus",
    egui: "egui", iced: "iced", leptos: "Leptos", ratatui: "Ratatui", rocket: "Rocket",
    tauri: "Tauri", tokio: "Tokio", warp: "warp", yew: "Yew",
  },
  packagist: {
    "cakephp/cakephp": "CakePHP", "laminas/laminas-mvc": "Laminas",
    "laravel/framework": "Laravel", "livewire/livewire": "Livewire", "slim/slim": "Slim",
    "symfony/framework-bundle": "Symfony", "yiisoft/yii2": "Yii",
  },
  rubygems: { hanami: "Hanami", jekyll: "Jekyll", rails: "Rails", roda: "Roda", sinatra: "Sinatra" },
};
