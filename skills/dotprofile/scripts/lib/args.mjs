/** `--name value` and `--flag` options, and the remaining positional arguments. */
export function parseArgs(argv, flags = []) {
  const options = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) positional.push(arg);
    else if (flags.includes(arg.slice(2))) options[arg.slice(2)] = true;
    else {
      if (argv[i + 1] === undefined) throw new Error(`${arg} needs a value`);
      options[arg.slice(2)] = argv[++i];
    }
  }
  return { options, positional };
}

/** Runs a CLI entry point, printing errors without a stack trace. */
export function run(main) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  });
}
