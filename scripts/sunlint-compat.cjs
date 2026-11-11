// Sunlint 1.3.56 emits a Windows drive path in the generated ESLint ESM import.
// Node rejects it with ERR_UNSUPPORTED_ESM_URL_SCHEME.
// TODO: Remove this preload and its npm script flag once the upgraded Sunlint
// CLI completes the ESLint batch on Windows without the preload.
// Upstream: https://github.com/sun-asterisk/engineer-excellence/issues
if (process.platform === 'win32') {
  const fs = require('node:fs/promises');
  const {pathToFileURL} = require('node:url');
  const Engine = require('@sun-asterisk/sunlint/engines/eslint-engine');
  const original = Engine.prototype.createTemporaryFlatConfig;
  Engine.prototype.createTemporaryFlatConfig = async function (...args) {
    const configPath = await original.apply(this, args);
    const content = await fs.readFile(configPath, 'utf8');
    const normalized = content.replace(
      /import customPlugin from '([^']+)'/,
      (_, pluginPath) => `import customPlugin from '${pathToFileURL(pluginPath).href}'`,
    );
    await fs.writeFile(configPath, normalized);
    return configPath;
  };
}
