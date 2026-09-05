const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Keep pnpm's shared dependency tree and the mobile app's workspace packages
// visible to Metro without watching volatile workspace directories (such as
// temporary skill folders) that may disappear while Metro is crawling them.
config.watchFolders = [
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'lib/api-client-react'),
  path.resolve(workspaceRoot, 'lib/copy'),
  path.resolve(workspaceRoot, 'lib/live-tally'),
  path.resolve(workspaceRoot, 'lib/socket-contract'),
];

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
