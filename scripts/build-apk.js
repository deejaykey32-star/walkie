import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '../public');
const targetApkPath = path.join(publicDir, 'walkie-talkie-p2p.apk');
const compiledApkPath = path.resolve(__dirname, '../android/app/build/outputs/apk/debug/app-debug.apk');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (fs.existsSync(compiledApkPath)) {
  fs.copyFileSync(compiledApkPath, targetApkPath);
  const stats = fs.statSync(targetApkPath);
  console.log(`[Build APK] Successfully copied compiled Android APK (${(stats.size / 1024 / 1024).toFixed(2)} MB) to public/walkie-talkie-p2p.apk`);
} else {
  console.log('[Build APK] Compiled APK not found at default location, ensuring target exists.');
}
