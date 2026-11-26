const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function storeImage(file) {
  const dest = path.join(UPLOAD_DIR, `${Date.now()}-${file.originalname}`);
  await fs.promises.rename(file.path, dest);
  return {
    storage: 'local',
    url: `/uploads/${path.basename(dest)}`,
    sizeBytes: file.size,
    mime: file.mimetype,
  };
}

async function storeMaterial(file) {
  const dest = path.join(UPLOAD_DIR, `${Date.now()}-${file.originalname}`);
  await fs.promises.rename(file.path, dest);
  return {
    storage: 'local',
    url: `/uploads/${path.basename(dest)}`,
    sizeBytes: file.size,
    mime: file.mimetype,
  };
}

module.exports = { storeImage, storeMaterial };
