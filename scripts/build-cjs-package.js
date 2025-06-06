import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create the CJS package.json after the build
const cjsDir = path.join(__dirname, '..', 'dist', 'cjs');
const packageJsonPath = path.join(cjsDir, 'package.json');

// Ensure the directory exists
if (!fs.existsSync(cjsDir)) {
  fs.mkdirSync(cjsDir, { recursive: true });
}

// Write the package.json file to mark this as CommonJS
fs.writeFileSync(packageJsonPath, JSON.stringify({ type: 'commonjs' }, null, 2));

console.log('Created package.json for CommonJS build'); 