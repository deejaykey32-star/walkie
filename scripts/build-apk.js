import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.resolve(rootDir, 'public');
const targetApkPath = path.join(publicDir, 'walkie-talkie-p2p.apk');
const compiledApkPath = path.resolve(rootDir, 'android/app/build/outputs/apk/debug/app-debug.apk');

try {
  console.log('[Build APK] Step 1: Building Vite web production bundle...');
  execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' });

  console.log('[Build APK] Step 2: Syncing Capacitor Android assets...');
  execSync('npx cap sync android', { cwd: rootDir, stdio: 'inherit' });

  console.log('[Build APK] Step 3: Compiling Android APK with Gradle...');
  const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug';
  execSync(gradlewCmd, { cwd: path.resolve(rootDir, 'android'), stdio: 'inherit' });

  if (fs.existsSync(compiledApkPath)) {
    fs.copyFileSync(compiledApkPath, targetApkPath);
    const stats = fs.statSync(targetApkPath);
    console.log(`[Build APK] Successfully compiled & copied Android APK (${(stats.size / 1024 / 1024).toFixed(2)} MB) to public/walkie-talkie-p2p.apk`);
  } else {
    console.error('[Build APK] Error: Compiled APK not found!');
    process.exit(1);
  }
} catch (err) {
  console.error('[Build APK] Build process failed:', err);
  process.exit(1);
}
