const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Required for pnpm monorepos: let Metro watch & resolve packages from the
// workspace root so symlinked workspace packages are found correctly.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Exclude TypeScript declaration files from the module graph so Metro doesn't
// accidentally try to bundle compiled .d.ts output from lib/*/dist/.
config.resolver.sourceExts = (config.resolver.sourceExts || []).filter(
  (ext) => ext !== 'd.ts',
);

module.exports = config;
