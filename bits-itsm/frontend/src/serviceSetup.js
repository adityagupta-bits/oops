export const validCriticality = (value) => ['LOW', 'MEDIUM', 'HIGH'].includes(value);
export const eligibleServices = (catalog) => catalog.filter((item) => item.kind === 'SERVICE' && item.enabled && validCriticality(item.criticality));
