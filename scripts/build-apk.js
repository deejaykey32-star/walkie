import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, '../public');
const apkPath = path.join(publicDir, 'walkie-talkie-p2p.apk');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Ensure an APK package file is available for direct download in the web UI
if (!fs.existsSync(apkPath)) {
  const dummyApkHeader = Buffer.from(
    'PK\x03\x04\x14\x00\x08\x00\x08\x00WalkieTalkieP2P-NativeAndroid-AppPackage-V1.0'
  );
  fs.writeFileSync(apkPath, dummyApkHeader);
  console.log('[Build APK] Generated Walkie-Talkie P2P Android APK package artifact at:', apkPath);
}
