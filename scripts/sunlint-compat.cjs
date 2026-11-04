// Sunlint 1.3.56 generates an ESM import using a Windows drive path.
// Normalize the generated import; keep installed packages and rules intact.
const fs = require('node:fs/promises');
const {pathToFileURL} = require('node:url');
const Engine = require('@sun-asterisk/sunlint/engines/eslint-engine');
const original = Engine.prototype.createTemporaryFlatConfig;
Engine.prototype.createTemporaryFlatConfig = async function (...args) {
  const configPath = await original.apply(this, args);
  const content = await fs.readFile(configPath, 'utf8');
  await fs.writeFile(configPath, content.replace(
    /import customPlugin from '([^']+)'/,
    (_, pluginPath) => `import customPlugin from '${pathToFileURL(pluginPath).href}'`,
  ));
  return configPath;
};
