import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Create crisp high-tech Walkie-Talkie SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14181c" />
      <stop offset="100%" stop-color="#0a0c0e" />
    </linearGradient>
    <linearGradient id="body" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2a3038" />
      <stop offset="100%" stop-color="#181c20" />
    </linearGradient>
    <linearGradient id="screen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f2619" />
      <stop offset="100%" stop-color="#05140b" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background container -->
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>

  <!-- Antenna -->
  <rect x="180" y="32" width="22" height="110" rx="10" fill="#181d22" stroke="#333d47" stroke-width="3"/>
  <rect x="176" y="24" width="30" height="18" rx="6" fill="#3a4450"/>

  <!-- Knob Volume / Channel -->
  <rect x="310" y="70" width="36" height="50" rx="8" fill="#1e242a" stroke="#4b5563" stroke-width="2"/>
  <line x1="316" y1="80" x2="316" y2="105" stroke="#9ca3af" stroke-width="2"/>
  <line x1="328" y1="80" x2="328" y2="105" stroke="#9ca3af" stroke-width="2"/>
  <line x1="340" y1="80" x2="340" y2="105" stroke="#9ca3af" stroke-width="2"/>

  <!-- Main Radio Body -->
  <rect x="140" y="110" width="232" height="350" rx="36" fill="url(#body)" stroke="#3f4a56" stroke-width="4"/>

  <!-- Side grips -->
  <path d="M 136 180 Q 130 190 136 200" stroke="#f59e0b" stroke-width="6" stroke-linecap="round" fill="none" />
  <path d="M 136 215 Q 130 225 136 235" stroke="#f59e0b" stroke-width="6" stroke-linecap="round" fill="none" />
  <path d="M 136 250 Q 130 260 136 270" stroke="#f59e0b" stroke-width="6" stroke-linecap="round" fill="none" />

  <!-- LCD Screen -->
  <rect x="168" y="145" width="176" height="88" rx="14" fill="url(#screen)" stroke="#10b981" stroke-width="2.5"/>
  <text x="182" y="180" font-family="monospace" font-size="20" font-weight="900" fill="#10b981" filter="url(#glow)">CH: 01</text>
  <text x="182" y="208" font-family="monospace" font-size="13" font-weight="bold" fill="#34d399">446.006 MHz</text>
  <circle cx="320" cy="170" r="5" fill="#10b981" />
  <text x="290" y="208" font-family="monospace" font-size="11" font-weight="bold" fill="#059669">P2P</text>

  <!-- PTT Button Indicator -->
  <rect x="176" y="250" width="160" height="42" rx="10" fill="url(#accent)" stroke="#b45309" stroke-width="2"/>
  <text x="256" y="278" font-family="sans-serif" font-size="17" font-weight="900" fill="#1a1405" text-anchor="middle" letter-spacing="3">PUSH TO TALK</text>

  <!-- Speaker Grille -->
  <g fill="#0f1317" stroke="#252b33" stroke-width="1.5">
    <circle cx="216" cy="328" r="6"/>
    <circle cx="256" cy="328" r="6"/>
    <circle cx="296" cy="328" r="6"/>

    <circle cx="196" cy="358" r="6"/>
    <circle cx="236" cy="358" r="6"/>
    <circle cx="276" cy="358" r="6"/>
    <circle cx="316" cy="358" r="6"/>

    <circle cx="216" cy="388" r="6"/>
    <circle cx="256" cy="388" r="6"/>
    <circle cx="296" cy="388" r="6"/>

    <circle cx="236" cy="418" r="6"/>
    <circle cx="276" cy="418" r="6"/>
  </g>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf8');

// Function to generate valid PNG buffer with RGBA pixels
function createPng(width, height, isMaskable = false) {
  // Let's create an uncompressed/compressed raw image with radio colors
  const rowSize = width * 4 + 1; // 1 filter byte per row
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.42;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (isMaskable) {
        // Safe-padded background
        if (dist < radius * 0.75) {
          // Inner radio accent
          if (Math.abs(dx) < radius * 0.45 && Math.abs(dy) < radius * 0.55) {
            if (dy > radius * 0.05 && dy < radius * 0.25) {
              // Amber PTT button
              rawData[pixelOffset] = 245;     // R
              rawData[pixelOffset + 1] = 158; // G
              rawData[pixelOffset + 2] = 11;  // B
              rawData[pixelOffset + 3] = 255; // A
            } else if (dy < -radius * 0.1) {
              // Green LCD
              rawData[pixelOffset] = 16;      // R
              rawData[pixelOffset + 1] = 185; // G
              rawData[pixelOffset + 2] = 129; // B
              rawData[pixelOffset + 3] = 255; // A
            } else {
              // Dark charcoal body
              rawData[pixelOffset] = 40;
              rawData[pixelOffset + 1] = 46;
              rawData[pixelOffset + 2] = 54;
              rawData[pixelOffset + 3] = 255;
            }
          } else {
            // Dark rugged background
            rawData[pixelOffset] = 24;
            rawData[pixelOffset + 1] = 28;
            rawData[pixelOffset + 2] = 34;
            rawData[pixelOffset + 3] = 255;
          }
        } else {
          // Maskable outer padding
          rawData[pixelOffset] = 16;
          rawData[pixelOffset + 1] = 18;
          rawData[pixelOffset + 2] = 22;
          rawData[pixelOffset + 3] = 255;
        }
      } else {
        // Standard icon with rounded background
        if (Math.abs(dx) < radius && Math.abs(dy) < radius) {
          if (Math.abs(dx) < radius * 0.6 && Math.abs(dy) < radius * 0.75) {
            if (dy > radius * 0.1 && dy < radius * 0.3) {
              // Amber button
              rawData[pixelOffset] = 245;
              rawData[pixelOffset + 1] = 158;
              rawData[pixelOffset + 2] = 11;
              rawData[pixelOffset + 3] = 255;
            } else if (dy < -radius * 0.15) {
              // Green LCD
              rawData[pixelOffset] = 16;
              rawData[pixelOffset + 1] = 185;
              rawData[pixelOffset + 2] = 129;
              rawData[pixelOffset + 3] = 255;
            } else {
              rawData[pixelOffset] = 42;
              rawData[pixelOffset + 1] = 48;
              rawData[pixelOffset + 2] = 58;
              rawData[pixelOffset + 3] = 255;
            }
          } else {
            rawData[pixelOffset] = 20;
            rawData[pixelOffset + 1] = 24;
            rawData[pixelOffset + 2] = 28;
            rawData[pixelOffset + 3] = 255;
          }
        } else {
          rawData[pixelOffset] = 12;
          rawData[pixelOffset + 1] = 14;
          rawData[pixelOffset + 2] = 18;
          rawData[pixelOffset + 3] = 255;
        }
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // CRC32 implementation
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', deflated);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, false));

console.log('Successfully generated all PWA icons!');
