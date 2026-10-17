import { parseToml } from "./toml.mjs";

/**
 * Parsers for the manifests at the repository root. Each returns what the file declares:
 * `{ description?, dependencies, otherDependencies, scripts, runtime?, workspaces }`.
 * `otherDependencies` (development, test, peer, optional) only serve to recognise frameworks.
 * The order decides which description wins when several manifests declare one.
 */
export const MANIFESTS = [
  { file: "package.json", ecosystem: "npm", parse: packageJson },
  { file: "pyproject.toml", ecosystem: "pypi", parse: pyprojectToml },
  { file: "Cargo.toml", ecosystem: "cargo", parse: cargoToml },
  { file: "go.mod", ecosystem: "go", parse: goMod },
  { file: "composer.json", ecosystem: "packagist", parse: composerJson },
  { file: "Gemfile", ecosystem: "rubygems", parse: gemfile },
  { file: "requirements.txt", ecosystem: "pypi", parse: requirementsTxt },
];

export class ManifestError extends Error {
  constructor(file, reason) {
    super(`${file}: ${reason}`);
    this.name = "ManifestError";
  }
}

const fields = (value) => (typeof value === "object" && value !== null && !Array.isArray(value) ? value : {});
const keys = (value) => Object.keys(fields(value));
const text = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined);
const runtime = (name, version) => (version === undefined ? {} : { runtime: { runtime: name, version } });
const withDescription = (description) => (description === undefined ? {} : { description });

/** PEP 503 normalisation, so that `Flask_Login` and `flask-login` are the same package. */
const normalizePythonName = (name) => name.toLowerCase().replace(/[-_.]+/g, "-");

/** The package name at the start of a PEP 508 requirement such as `django[argon2]>=4`. */
function pep508Name(requirement) {
  const match = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(requirement);
  return match ? normalizePythonName(match[1]) : undefined;
}

const requirementNames = (value) =>
  Array.isArray(value) ? value.flatMap((item) => (typeof item === "string" ? (pep508Name(item) ?? []) : [])) : [];

function json(file, source) {
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new ManifestError(file, "not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new ManifestError(file, "not a JSON object");
  return parsed;
}

function toml(file, source) {
  try {
    return parseToml(source);
  } catch {
    throw new ManifestError(file, "not valid TOML");
  }
}

function packageJson(source) {
  const manifest = json("package.json", source);
  const workspaces = manifest.workspaces;
  return {
    ...withDescription(text(manifest.description)),
    dependencies: keys(manifest.dependencies),
    otherDependencies: [...keys(manifest.devDependencies), ...keys(manifest.peerDependencies), ...keys(manifest.optionalDependencies)],
    scripts: keys(manifest.scripts),
    ...runtime("Node.js", text(fields(manifest.engines).node)),
    workspaces: (Array.isArray(workspaces) && workspaces.length > 0) || Array.isArray(fields(workspaces).packages),
  };
}

/** Both the standard `[project]` table (PEP 621) and Poetry's `[tool.poetry]`. */
function pyprojectToml(source) {
  const manifest = toml("pyproject.toml", source);
  const project = fields(manifest.project);
  const tool = fields(manifest.tool);
  const poetry = fields(tool.poetry);
  const poetryDependencies = fields(poetry.dependencies);
  const poetryPython = poetryDependencies.python;
  const poetryGroups = Object.values(fields(poetry.group)).flatMap((group) => keys(fields(group).dependencies));
  return {
    ...withDescription(text(project.description) ?? text(poetry.description)),
    dependencies: [
      ...requirementNames(project.dependencies),
      ...keys(poetryDependencies).filter((name) => name !== "python").map(normalizePythonName),
    ],
    otherDependencies: [
      ...Object.values(fields(project["optional-dependencies"])).flatMap(requirementNames),
      ...Object.values(fields(manifest["dependency-groups"])).flatMap(requirementNames),
      ...[...keys(poetry["dev-dependencies"]), ...poetryGroups].map(normalizePythonName),
    ],
    scripts: [...keys(project.scripts), ...keys(poetry.scripts)],
    ...runtime("Python", text(project["requires-python"]) ?? text(poetryPython) ?? text(fields(poetryPython).version)),
    workspaces: fields(tool.uv).workspace !== undefined,
  };
}

function cargoToml(source) {
  const manifest = toml("Cargo.toml", source);
  const pkg = fields(manifest.package);
  return {
    ...withDescription(text(pkg.description)),
    dependencies: keys(manifest.dependencies),
    otherDependencies: [
      ...keys(manifest["dev-dependencies"]),
      ...keys(manifest["build-dependencies"]),
      ...keys(fields(manifest.workspace).dependencies),
    ],
    scripts: [],
    ...runtime("Rust", text(pkg["rust-version"])),
    workspaces: manifest.workspace !== undefined,
  };
}

/** Direct requirements only: `// indirect` ones are dependencies of dependencies. */
function goMod(source) {
  const names = [];
  let inBlock = false;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (inBlock && line === ")") inBlock = false;
    else if (/^require\s*\($/.test(line)) inBlock = true;
    else if (!line.includes("// indirect")) {
      const match = (inBlock ? /^(\S+)\s+v\S+/ : /^require\s+(\S+)\s+v\S+/).exec(line);
      if (match) names.push(match[1]);
    }
  }
  return {
    dependencies: names,
    otherDependencies: [],
    scripts: [],
    ...runtime("Go", /^go\s+(\S+)\s*$/m.exec(source)?.[1]),
    workspaces: false,
  };
}

/** Platform requirements are the PHP version itself and its extensions, not packages. */
const isPlatform = (name) => name === "php" || /^(ext|lib|composer)-/.test(name);

function composerJson(source) {
  const manifest = json("composer.json", source);
  return {
    ...withDescription(text(manifest.description)),
    dependencies: keys(manifest.require).filter((name) => !isPlatform(name)),
    otherDependencies: keys(manifest["require-dev"]).filter((name) => !isPlatform(name)),
    scripts: keys(manifest.scripts),
    ...runtime("PHP", text(fields(manifest.require).php)),
    workspaces: false,
  };
}

const DEVELOPMENT_GROUPS = new Set(["development", "test"]);

/** True when every group named in `group :a, :b` or `group: [:a]` is a development group. */
function isDevelopmentGroup(groups) {
  const names = [...groups.matchAll(/:(\w+)/g)].map((match) => match[1]);
  return names.length > 0 && names.every((name) => DEVELOPMENT_GROUPS.has(name));
}

/** A line-based reading of the Gemfile DSL, following `do … end` blocks to find development groups. */
function gemfile(source) {
  const dependencies = [];
  const otherDependencies = [];
  const blocks = [];
  let ruby;
  for (const raw of source.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    const group = /^group\s+(.+?)\s+do\b/.exec(line);
    const gem = /^gem\s+["']([^"']+)["'](.*)$/.exec(line);
    if (group) blocks.push(isDevelopmentGroup(group[1]));
    else if (/\bdo(\s*\|[^|]*\|)?$/.test(line) || /^(if|unless|case|begin)\b/.test(line)) blocks.push(false);
    else if (/^end\b/.test(line)) blocks.pop();
    else if (gem) {
      const inline = /groups?:\s*(.+)$/.exec(gem[2])?.[1];
      const development = blocks.some(Boolean) || (inline !== undefined && isDevelopmentGroup(inline));
      (development ? otherDependencies : dependencies).push(gem[1]);
    } else ruby ??= /^ruby\s+["']([^"']+)["']/.exec(line)?.[1];
  }
  return { dependencies, otherDependencies, scripts: [], ...runtime("Ruby", ruby), workspaces: false };
}

function requirementsTxt(source) {
  const dependencies = source.split("\n").flatMap((raw) => {
    const line = raw.replace(/(^|\s)#.*$/, "").trim();
    // Options (-r, -e, --index-url…) and bare URLs name no package.
    if (line === "" || line.startsWith("-") || /^[a-z+]+:\/\//i.test(line)) return [];
    return pep508Name(line) ?? [];
  });
  return { dependencies, otherDependencies: [], scripts: [], workspaces: false };
}
