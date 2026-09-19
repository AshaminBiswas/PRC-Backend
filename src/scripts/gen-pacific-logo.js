const fs = require('fs');
const path = require('path');

const imgPath = 'd:/admin/public/pacific_logo.png';
if (fs.existsSync(imgPath)) {
  const b64 = fs.readFileSync(imgPath).toString('base64');
  const code = `export const PACIFIC_LOGO_DATA_URL = "data:image/png;base64,${b64}";\n`;
  fs.writeFileSync('d:/admin/src/assets/pacific_logo.base64.ts', code);
  fs.writeFileSync('d:/PRC-Backend/src/assets/pacific_logo.base64.ts', code);
  console.log('Successfully written pacific_logo.base64.ts in admin and PRC-Backend');
} else {
  console.error('pacific_logo.png not found at', imgPath);
}
