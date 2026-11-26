const CONFUSION_PATTERNS = [
  /\bdon'?t understand\b/i,
  /\bdoes'?nt understand\b/i,
  /\bnot understanding\b/i,
  /\bconfused\b/i,
  /\bconfusing\b/i,
  /\bunclear\b/i,
  /\bnot clear\b/i,
  /\blost\b/i,
  /\bdoubtn'?t\b/i,
  /\bdoubts?\b/i,
  /\bexplain again\b/i,
  /\bcan you explain\b/i,
  /\bcould you explain\b/i,
  /\bnot following\b/i,
  /\bhard to follow\b/i,
  /\bdifficult to follow\b/i,
  /\bstruggl(?:e|ing)\b/i,
];

const QUESTION_PATTERNS = [
  /^\s*(what|why|how|when|where|who|which|can|could|should|is|are|does|do)\b/i,
  /\?$/,
];

const IMPORTANT_PATTERNS = [
  /\bimportant\b/i,
  /\bremember\b/i,
  /\bkey point\b/i,
  /\bexam\b/i,
];

function classifyText(text = '', ocrText = '') {
  const content = `${text || ''} ${ocrText || ''}`.trim();
  if (!content) {
    return { type: 'NEUTRAL', confidence: 1, matchedTerms: [] };
  }

  const confusionMatches = CONFUSION_PATTERNS
    .filter((pattern) => pattern.test(content))
    .map((pattern) => pattern.source.replace(/\\b/g, '').replace(/\\/g, ''));

  if (confusionMatches.length) {
    return {
      type: 'CONFUSION',
      confidence: Math.min(0.95, 0.65 + (confusionMatches.length - 1) * 0.1),
      matchedTerms: confusionMatches,
    };
  }

  const questionMatches = QUESTION_PATTERNS.filter((pattern) => pattern.test(content));
  if (questionMatches.length) {
    return {
      type: 'QUESTION',
      confidence: Math.min(0.95, 0.7 + (questionMatches.length - 1) * 0.1),
      matchedTerms: questionMatches.map((pattern) => pattern.source.replace(/\\b/gi, '')),
    };
  }

  const importantMatches = IMPORTANT_PATTERNS.filter((pattern) => pattern.test(content));
  if (importantMatches.length) {
    return {
      type: 'IMPORTANT',
      confidence: Math.min(0.9, 0.65 + (importantMatches.length - 1) * 0.1),
      matchedTerms: importantMatches.map((pattern) => pattern.source.replace(/\\b/g, '')),
    };
  }

  return { type: 'NEUTRAL', confidence: 0.8, matchedTerms: [] };
}

function effectiveType(observation) {
  const classified = observation?.classification?.type;
  if (classified === 'QUESTION' || classified === 'CONFUSION' || classified === 'IMPORTANT') {
    return classified;
  }
  return observation?.type || 'NEUTRAL';
}

module.exports = {
  classifyText,
  effectiveType,
};