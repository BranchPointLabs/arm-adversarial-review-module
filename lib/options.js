function parseOptions(args) {
  const options = {
    backend: null,
    model: null,
    maxWords: null,
    output: null,
    noWrite: false,
    prompt: false,
    stdin: false,
  };

  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--prompt") {
      options.prompt = true;
      continue;
    }

    if (arg === "--no-write") {
      options.noWrite = true;
      continue;
    }

    if (arg === "--stdin") {
      options.stdin = true;
      continue;
    }

    if (["--backend", "--model", "--max-words", "--output"].includes(arg)) {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`Missing value for ${arg}`);
      }

      index += 1;
      if (arg === "--backend") options.backend = value;
      if (arg === "--model") options.model = value;
      if (arg === "--max-words") options.maxWords = Number(value);
      if (arg === "--output") options.output = value;
      continue;
    }

    positionals.push(arg);
  }

  if (options.maxWords !== null && (!Number.isInteger(options.maxWords) || options.maxWords < 50)) {
    throw new Error("--max-words must be an integer >= 50");
  }

  return { positionals, options };
}

module.exports = {
  parseOptions,
};
