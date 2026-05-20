const sharp = require('sharp');
const fs = require('fs');

const INPUT = 'DSCF9110.JPG';
const OUTPUT = 'DSCF9110_enhanced.JPG';

async function enhance() {
  const inputBuffer = fs.readFileSync(INPUT);
  const metadata = await sharp(inputBuffer).metadata();
  console.log(`原图: ${metadata.width}x${metadata.height}, orientation: ${metadata.orientation}`);

  const autoW = metadata.autoOrient?.width || metadata.width;
  const autoH = metadata.autoOrient?.height || metadata.height;
  const longEdge = 2400;
  let resizeW, resizeH;
  if (autoW >= autoH) {
    resizeW = longEdge;
    resizeH = Math.round(autoH * longEdge / autoW);
  } else {
    resizeH = longEdge;
    resizeW = Math.round(autoW * longEdge / autoH);
  }
  console.log(`输出尺寸: ${resizeW}x${resizeH}`);

  // Small original preview
  await sharp(inputBuffer)
    .rotate()
    .resize(800, null, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile('DSCF9110_original_small.jpg');
  console.log('已生成原图小样');

  // ===== MAIN ENHANCEMENT =====
  // Strategy: Boost saturation & contrast in sRGB, then sharpen for clarity
  await sharp(inputBuffer)
    .rotate()
    .resize(resizeW, resizeH, { fit: 'fill', kernel: 'lanczos3' })

    // Color & exposure — keep modulate first before any linear ops
    .modulate({
      brightness: 1.10,   // +10% brightness
      saturation: 1.30,   // +30% saturation for "神图" pop
      hue: 4,             // slight warm shift
    })

    // Gentle S-curve contrast via linear — maps [0.03..0.97] to [0..1]
    .linear(0.03, 0.97)

    // Sharpen for detail clarity (replaces CLAHE + sharpen combo)
    .sharpen({
      sigma: 0.9,
      m1: 0.6,   // gentle sharpen in flat areas (sky, clouds)
      m2: 2.0,   // strong sharpen at edges (mountains, trees)
    })

    // High quality output
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toFile(OUTPUT);

  const outMeta = await sharp(OUTPUT).metadata();
  const outSize = fs.statSync(OUTPUT).size;
  console.log(`增强完成: ${OUTPUT} (${outMeta.width}x${outMeta.height}, ${(outSize/1024).toFixed(0)}KB, channels: ${outMeta.channels})`);
}

enhance().catch(err => { console.error(err); process.exit(1); });
