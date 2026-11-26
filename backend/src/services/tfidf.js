function tokenize(text = '') {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function buildVocabulary(docs) {
  const vocab = new Map();
  for (const doc of docs) {
    for (const tok of tokenize(doc)) {
      if (!vocab.has(tok)) vocab.set(tok, vocab.size);
    }
  }
  return vocab;
}

function tfidfVector(text, vocab, df) {
  const tokens = tokenize(text);
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const vec = new Array(vocab.size).fill(0);
  const N = df.N || 1;
  for (const [t, count] of tf) {
    const idx = vocab.get(t);
    if (idx === undefined) continue;
    const idf = Math.log((1 + N) / (1 + (df.df.get(t) || 0))) + 1;
    vec[idx] = (count / tokens.length) * idf;
  }
  return vec;
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

module.exports = { tokenize, buildVocabulary, tfidfVector, cosine };
