/**
 * After `npx cap sync`, the CLI overwrites iOS `packageClassList` with only classes
 * found in npm Capacitor plugins. Merge classes from the root `capacitor.config.json`
 * so local SPM plugins (e.g. MdmConfigPlugin) stay registered.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const rootCap = JSON.parse(
  readFileSync(join(root, 'capacitor.config.json'), 'utf8'),
);
const iosPath = join(root, 'mobile/ios/App/App/capacitor.config.json');
const iosCap = JSON.parse(readFileSync(iosPath, 'utf8'));
const fromRoot = rootCap.packageClassList || [];
const merged = [
  ...new Set([...(iosCap.packageClassList || []), ...fromRoot]),
];
iosCap.packageClassList = merged;
writeFileSync(iosPath, `${JSON.stringify(iosCap, null, '\t')}\n`);
