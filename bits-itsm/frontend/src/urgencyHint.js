export function urgencyHint(title = '', description = '') {
  const text = `${title}. ${description}`.toLowerCase();
  if (/\b(not urgent|no urgency|not time sensitive|no immediate deadline)\b/.test(text)) return null;
  const sentences = text.split(/[.!?;\n]+/).filter(s => !/\b(no|not|without|isn't|is not|don't|doesn't)\s+(?:an?\s+)?(?:exam|test|deadline|urgent|blocked)\b/.test(s));
  const evidence = sentences.filter(s => {
    const deadline = /\b(exam|test|submission|assignment)\b/.test(s) && /\b(today|tomorrow|within|due|deadline|starts? in|in \d+ (?:minutes?|hours?))\b/.test(s);
    const blocked = /\b(cannot|can't|unable to|blocked|fails? to)\b/.test(s) && /\b(submit|access|log in|login|study|coursework)\b/.test(s);
    const immediate = /\b(right now|immediately|within \d+|next hour)\b/.test(s);
    return deadline || (blocked && immediate);
  });
  return evidence.length ? { value: 'HIGH', reason: `Time-pressure evidence in the report: “${evidence[0].trim().slice(0, 240)}”.` } : null;
}
