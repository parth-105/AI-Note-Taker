let tesseractModule = null;

async function loadTesseract() {
  if (tesseractModule) return tesseractModule;
  try {
    tesseractModule = require('tesseract.js');
    return tesseractModule;
  } catch (err) {
    return null;
  }
}

function hasOcr() {
  return Boolean(tesseractModule);
}

async function extractTextFromImage(file, options = {}) {
  if (!file?.path || !file?.buffer) {
    return { text: '', provider: 'none', status: 'skipped' };
  }

  const tesseract = await loadTesseract();
  if (!tesseract) {
    return {
      text: '',
      provider: 'unavailable',
      status: 'unavailable',
      message: 'OCR dependency is not installed. Install tesseract.js to enable OCR.',
    };
  }

  try {
    const language = options.language || 'eng';
    const source = file.path || file.buffer;
    const result = await tesseract.recognize(source, language);
    return {
      text: (result?.data?.text || '').trim(),
      provider: 'tesseract.js',
      status: 'done',
      confidence: result?.data?.confidence,
    };
  } catch (err) {
    return {
      text: '',
      provider: 'tesseract.js',
      status: 'error',
      message: String(err && err.message),
    };
  }
}

module.exports = {
  extractTextFromImage,
  hasOcr,
};