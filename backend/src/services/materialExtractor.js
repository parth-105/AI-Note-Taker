const pdfParse = require('pdf-parse');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');

async function extractFromPdf(buffer) {
  try {
    const data = await pdfParse(buffer);
    const pages = (data.text || '').split(/\f/).filter((t) => t.trim());
    const fullText = (data.text || '').trim();
    if (!fullText) return { status: 'no-text-found', pages: [], fullText, wordCount: 0 };
    return {
      status: 'done',
      pages: pages.map((text, index) => ({ index, text })),
      fullText,
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
    };
  } catch (err) {
    return { status: 'error', message: String(err && err.message) };
  }
}

async function extractFromPptx(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort();
    const parser = new XMLParser({ ignoreAttributes: false });
    const pages = [];
    for (const file of files.slice(0, 60)) {
      const xml = await zip.file(file).async('string');
      const json = parser.parse(xml);
      const text = extractText(json);
      if (text.trim()) pages.push({ index: pages.length + 1, text });
    }
    const fullText = pages.map((p) => p.text).join('\n');
    if (!fullText) return { status: 'no-text-found', pages: [], fullText, wordCount: 0 };
    return { status: 'done', pages, fullText, wordCount: fullText.split(/\s+/).filter(Boolean).length };
  } catch (err) {
    return { status: 'error', message: String(err && err.message) };
  }
}

function extractText(node) {
  if (!node || typeof node !== 'object') return '';
  if (typeof node === 'string') return node;
  let out = '';
  for (const [k, v] of Object.entries(node)) {
    if (k === 'a:t' && typeof v === 'string') out += v;
    else if (typeof v === 'object') out += extractText(v);
    else if (typeof v === 'string' && (k.split(':').pop() === 't')) out += v;
  }
  return out;
}

async function extractMaterial(filename, buffer) {
  if (/\.pdf$/i.test(filename)) return extractFromPdf(buffer);
  if (/\.(pptx?)$/i.test(filename)) return extractFromPptx(buffer);
  return { status: 'no-text-found', pages: [], message: 'Unsupported format' };
}

module.exports = { extractMaterial };