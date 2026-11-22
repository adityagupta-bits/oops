export function dispositionPayload(kind, reason, duplicateOf) {
  const trimmed = reason.trim();
  if (trimmed.length < 5 || trimmed.length > 2000) throw new Error('Enter a reason between 5 and 2000 characters.');
  if (!['WITHDRAWN', 'INVALID', 'DUPLICATE'].includes(kind)) throw new Error('Choose a closure reason.');
  const id = kind === 'DUPLICATE' ? Number(duplicateOf) : null;
  if (kind === 'DUPLICATE' && (!Number.isSafeInteger(id) || id < 1)) throw new Error('Enter the original incident number.');
  return { kind, reason: trimmed, duplicateOf: id };
}
export function resolvedSuccessfully(incident) {
  return ['RESOLVED', 'VERIFIED'].includes(incident.status) || (incident.status === 'CLOSED' && Boolean(incident.resolvedAt));
}
