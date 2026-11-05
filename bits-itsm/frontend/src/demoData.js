// Read-only sample records shared by the portal previews.
const baseIncidents = [
  { id: 'INC-1004', title: 'Campus Wi-Fi not connecting', category: 'NETWORK', affectedService: 'Campus Wi-Fi', description: 'Unable to connect to campus Wi-Fi in the library since this morning.', impact: 'MEDIUM', urgency: 'HIGH', priority: 'P2', status: 'NEW', createdAt: '2026-11-02T10:30:00', assignedTechnician: null, resolution: null },
  { id: 'INC-1003', title: 'Student portal login error', category: 'AUTHENTICATION', affectedService: 'Student Portal', description: 'The student portal returns a login error after entering account details.', impact: 'LOW', urgency: 'MEDIUM', priority: 'P3', status: 'CLASSIFIED', createdAt: '2026-11-01T09:15:00', assignedTechnician: null, resolution: null },
  { id: 'INC-1002', title: 'Lab computer malfunction', category: 'HARDWARE', affectedService: 'Lab Computers', description: 'A computer in the programming lab shuts down unexpectedly during use.', impact: 'LOW', urgency: 'HIGH', priority: 'P2', status: 'ASSIGNED', createdAt: '2026-10-30T14:20:00', assignedTechnician: 'Demo Technician One', resolution: null },
  { id: 'INC-1001', title: 'Software installation problem', category: 'SOFTWARE', affectedService: 'Lab Computers', description: 'The required course software fails to install on a lab computer.', impact: 'LOW', urgency: 'LOW', priority: 'P4', status: 'RESOLVED', createdAt: '2026-10-28T11:00:00', assignedTechnician: 'Demo Technician Two', resolution: 'Installed the approved software package and confirmed it launches.' },
  { id: 'INC-1005', title: 'SWD Pay Failure', category: 'SOFTWARE', affectedService: 'Student Portal', description: 'The SWD payment page shows an error when students try to complete payment.', impact: 'HIGH', urgency: 'HIGH', priority: 'P1', status: 'IN_PROGRESS', createdAt: '2026-10-24T15:45:00', assignedTechnician: 'Demo Technician Two', resolution: null },
  { id: 'INC-1006', title: 'LMS Not Working', category: 'APPLICATION', affectedService: 'Student Portal', description: 'Course materials fail to load in the learning management system.', impact: 'MEDIUM', urgency: 'HIGH', priority: 'P2', status: 'ACKNOWLEDGED', createdAt: '2026-10-22T08:40:00', assignedTechnician: 'Demo Technician One', resolution: null },
  { id: 'INC-1007', title: 'ERP Failure', category: 'AUTHENTICATION', affectedService: 'Student Portal', description: 'The ERP session ends immediately after signing in.', impact: 'MEDIUM', urgency: 'MEDIUM', priority: 'P2', status: 'CLOSED', createdAt: '2026-10-20T13:10:00', assignedTechnician: 'Demo Technician One', resolution: 'Corrected the session configuration; the student confirmed access was restored.' },
  { id: 'INC-1009', title: 'Wifi In F102 Not Working', category: 'NETWORK', affectedService: 'Campus Wi-Fi', description: 'The wireless access point in F102 does not provide a usable connection.', impact: 'MEDIUM', urgency: 'MEDIUM', priority: 'P3', status: 'VERIFIED', createdAt: '2026-10-29T10:00:00', assignedTechnician: 'Demo Technician Two', resolution: 'Reconfigured the access point and verified connectivity in F102.' },
];

export const technicianSkills = [
  { value: 'NETWORK', label: 'Networking' }, { value: 'HARDWARE', label: 'Hardware' },
  { value: 'SOFTWARE', label: 'Software' }, { value: 'DATABASE', label: 'Database' },
  { value: 'AUTHENTICATION', label: 'Authentication' }, { value: 'CLOUD', label: 'Cloud Services' },
  { value: 'SECURITY', label: 'Security' }, { value: 'APPLICATION', label: 'Application Support' },
];

export const technicians = [
  { id: 'T101', name: 'Demo Technician One', email: 'technician01@hyderabad.bits-pilani.ac.in', skills: ['HARDWARE', 'AUTHENTICATION'], availability: 'AVAILABLE', workloadLimit: 3 },
  { id: 'T102', name: 'Demo Technician Two', email: 'technician02@hyderabad.bits-pilani.ac.in', skills: ['SOFTWARE', 'NETWORK'], availability: 'BUSY', workloadLimit: 1 },
  { id: 'T103', name: 'Demo Technician Three', email: 'technician03@hyderabad.bits-pilani.ac.in', skills: ['DATABASE', 'APPLICATION'], availability: 'AVAILABLE', workloadLimit: 3 },
  { id: 'T104', name: 'Demo Technician Four', email: 'technician04@hyderabad.bits-pilani.ac.in', skills: ['NETWORK', 'SECURITY', 'CLOUD'], availability: 'UNAVAILABLE', workloadLimit: 3 },
];

export const users = [
  { id: 'S101', studentId: '2025A7IS2420H', name: 'Kush Gupta', email: 'f20252420@hyderabad.bits-pilani.ac.in', role: 'STUDENT', status: 'ACTIVE', createdAt: '2026-10-01T09:00:00' },
  { id: 'S102', studentId: '2025A7PS0923H', name: 'Aditya Gupta', email: 'f20250923@hyderabad.bits-pilani.ac.in', role: 'STUDENT', status: 'ACTIVE', createdAt: '2026-10-01T09:00:00' },
  { id: 'S103', studentId: '2025A7PS0120H', name: 'Lakshya Goyal', email: 'f20250120@hyderabad.bits-pilani.ac.in', role: 'STUDENT', status: 'ACTIVE', createdAt: '2026-10-01T09:00:00' },
  { id: 'S104', studentId: '2025ADPS0218H', name: 'Aditya Dash', email: 'f20250218@hyderabad.bits-pilani.ac.in', role: 'STUDENT', status: 'ACTIVE', createdAt: '2026-10-01T09:00:00' },
  ...technicians.map(({ id, name, email }) => ({ id, name, email, role: 'TECHNICIAN', status: 'ACTIVE', createdAt: '2026-10-01T09:00:00' })),
  { id: 'A101', name: 'Demo Administrator', email: 'admin01@hyderabad.bits-pilani.ac.in', role: 'ADMIN', status: 'ACTIVE', createdAt: '2026-10-01T09:00:00' },
];

// Deadlines and risks are seeded examples, not calculated SLA results.
const incidentMetadata = {
  'INC-1004': { slaEvaluatedAt: '2026-11-02T10:40:00', slaWarning: 'is approaching its response deadline.', reporterId: 'S101', collaborators: [], slaStatus: 'AT_RISK', responseDeadline: '2026-11-02T10:45:00', resolutionDeadline: '2026-11-02T12:30:00' },
  'INC-1003': { slaEvaluatedAt: '2026-11-01T09:20:00', reporterId: 'S102', collaborators: [], slaStatus: 'ON_TRACK', responseDeadline: '2026-11-01T10:15:00', resolutionDeadline: '2026-11-01T17:15:00' },
  'INC-1002': { slaEvaluatedAt: '2026-10-30T14:36:00', slaWarning: 'has breached its response SLA. No acknowledgment is recorded.', assignedAt: '2026-10-30T14:28:00', reporterId: 'S103', collaborators: [], slaStatus: 'BREACHED', responseDeadline: '2026-10-30T14:35:00', resolutionDeadline: '2026-10-30T16:20:00' },
  'INC-1001': { slaEvaluatedAt: '2026-10-28T15:30:00', acknowledgedAt: '2026-10-28T11:12:00', actualResponseTime: '12 minutes', resolvedAt: '2026-10-28T15:30:00', assignedAt: '2026-10-28T11:10:00', reporterId: 'S104', collaborators: [], slaStatus: 'MET', responseDeadline: '2026-10-28T15:00:00', resolutionDeadline: '2026-10-29T11:00:00' },
  'INC-1005': { slaEvaluatedAt: '2026-10-24T16:26:00', acknowledgedAt: '2026-10-24T15:48:00', actualResponseTime: '3 minutes', slaWarning: 'has breached its resolution SLA.', assignedAt: '2026-10-24T15:47:00', reporterId: 'S101', collaborators: [{ technicianId: 'T103', responsibility: 'Inspect payment database connectivity' }], slaStatus: 'BREACHED', responseDeadline: '2026-10-24T15:50:00', resolutionDeadline: '2026-10-24T16:15:00', escalation: { reason: 'Payment outage exceeded the seeded resolution target.', level: 'System Administrator', escalatedAt: '2026-10-24T16:20:00' } },
  'INC-1006': { slaEvaluatedAt: '2026-10-22T10:25:00', acknowledgedAt: '2026-10-22T08:44:00', actualResponseTime: '4 minutes', slaWarning: 'is approaching its resolution deadline.', assignedAt: '2026-10-22T08:42:00', reporterId: 'S102', collaborators: [{ technicianId: 'T104', responsibility: 'Inspect network access to course materials' }], slaStatus: 'AT_RISK', responseDeadline: '2026-10-22T08:55:00', resolutionDeadline: '2026-10-22T10:40:00' },
  'INC-1007': { slaEvaluatedAt: '2026-10-20T15:00:00', acknowledgedAt: '2026-10-20T13:18:00', actualResponseTime: '8 minutes', resolvedAt: '2026-10-20T14:30:00', assignedAt: '2026-10-20T13:15:00', reporterId: 'S103', collaborators: [], slaStatus: 'MET', responseDeadline: '2026-10-20T13:25:00', resolutionDeadline: '2026-10-20T15:10:00' },
  'INC-1009': { slaEvaluatedAt: '2026-10-29T11:30:00', acknowledgedAt: '2026-10-29T10:15:00', actualResponseTime: '15 minutes', resolvedAt: '2026-10-29T11:15:00', assignedAt: '2026-10-29T10:10:00', reporterId: 'S104', collaborators: [], slaStatus: 'MET', responseDeadline: '2026-10-29T11:00:00', resolutionDeadline: '2026-10-29T18:00:00' },
};

export const demoIncidents = baseIncidents.map((incident) => ({
  ...incident, ...incidentMetadata[incident.id],
  primaryTechnicianId: technicians.find((technician) => technician.name === incident.assignedTechnician)?.id || '',
}));

export const transferRequests = [
  { id: 'TR-101', incidentId: 'INC-1005', currentTechnicianId: 'T102', suggestedTechnicianId: 'T104', reason: 'High workload; specialist network investigation is needed.', reasonType: 'HIGH_WORKLOAD', handover: 'Database checks are in progress with T103. Review gateway timeouts next.', requestedAt: '2026-10-24T16:25:00', status: 'PENDING', decision: null },
  { id: 'TR-102', incidentId: 'INC-1002', currentTechnicianId: 'T103', suggestedTechnicianId: 'T101', reason: 'Hardware specialist required for unexpected shutdowns.', reasonType: 'SKILLS', handover: 'Power cable checked; inspect the machine hardware.', requestedAt: '2026-10-30T14:25:00', status: 'APPROVED', decision: 'Approved in this fictional history: T101 became primary owner.', decidedAt: '2026-10-30T14:28:00' },
  { id: 'TR-103', incidentId: 'INC-1006', currentTechnicianId: 'T101', suggestedTechnicianId: 'T104', reason: 'Network assistance requested.', reasonType: 'SKILLS', handover: 'Course access fails intermittently.', requestedAt: '2026-10-22T08:45:00', status: 'REJECTED', decision: 'Retain T101 as primary; use collaboration for network assistance.', decidedAt: '2026-10-22T08:48:00' },
  { id: 'TR-104', incidentId: 'INC-1005', currentTechnicianId: 'T102', suggestedTechnicianId: 'T101', reason: 'High workload during payment investigation.', reasonType: 'HIGH_WORKLOAD', handover: 'Initial assessment only.', requestedAt: '2026-10-24T15:50:00', status: 'CANCELLED', decision: 'Requester withdrew this suggestion; a specialist was needed.', decidedAt: '2026-10-24T15:52:00' },
];

export const collaborationRequests = [
  { id: 'CR-101', incidentId: 'INC-1005', primaryTechnicianId: 'T102', requestedTechnicianId: 'T104', skills: ['NETWORK', 'SECURITY'], reason: 'Inspect gateway connectivity while T103 checks database access.', requestedAt: '2026-10-24T16:26:00', status: 'PENDING', decision: null },
  { id: 'CR-102', incidentId: 'INC-1006', primaryTechnicianId: 'T101', requestedTechnicianId: 'T104', skills: ['NETWORK'], reason: 'Support network diagnosis without changing primary ownership.', requestedAt: '2026-10-22T08:49:00', status: 'ACCEPTED', decision: 'T104 accepted and joined as network collaborator in this fictional history.', decidedAt: '2026-10-22T08:52:00' },
  { id: 'CR-103', incidentId: 'INC-1002', primaryTechnicianId: 'T101', requestedTechnicianId: 'T102', skills: ['SOFTWARE'], reason: 'Check whether software is causing shutdowns.', requestedAt: '2026-10-30T14:29:00', status: 'REJECTED', decision: 'Complete hardware checks before requesting software assistance.', decidedAt: '2026-10-30T14:30:00' },
  { id: 'CR-104', incidentId: 'INC-1005', primaryTechnicianId: 'T102', requestedTechnicianId: 'T101', skills: ['HARDWARE'], reason: 'Inspect a suspected hardware issue.', requestedAt: '2026-10-24T15:53:00', status: 'CANCELLED', decision: 'Hardware issue ruled out in the seeded investigation.', decidedAt: '2026-10-24T15:55:00' },
];

export const services = [
  { id: 'SVC-101', name: 'Campus Wi-Fi', category: 'NETWORK', description: 'Wireless access in campus buildings and common areas.', criticality: 'HIGH', status: 'DEGRADED' },
  { id: 'SVC-102', name: 'Student Portal', category: 'APPLICATION', description: 'Campus academic and student service applications.', criticality: 'HIGH', status: 'DEGRADED' },
  { id: 'SVC-103', name: 'Library Services', category: 'APPLICATION', description: 'Library catalog and digital resource access.', criticality: 'MEDIUM', status: 'OPERATIONAL' },
  { id: 'SVC-104', name: 'Lab Computers', category: 'HARDWARE', description: 'Shared teaching laboratory workstations.', criticality: 'MEDIUM', status: 'DEGRADED' },
  { id: 'SVC-105', name: 'Email Services', category: 'APPLICATION', description: 'Institutional email and approved mail clients.', criticality: 'HIGH', status: 'OPERATIONAL' },
  { id: 'SVC-106', name: 'Campus Network', category: 'NETWORK', description: 'Wired connectivity and campus network infrastructure.', criticality: 'HIGH', status: 'OPERATIONAL' },
  { id: 'SVC-107', name: 'Authentication Service', category: 'AUTHENTICATION', description: 'Institutional account sign-in and session services.', criticality: 'HIGH', status: 'OPERATIONAL' },
];

export const incidentCategories = [
  { name: 'HARDWARE', description: 'Workstations and physical IT equipment.', skills: ['HARDWARE'], status: 'ACTIVE' },
  { name: 'SOFTWARE', description: 'Installation and operation of approved software.', skills: ['SOFTWARE'], status: 'ACTIVE' },
  { name: 'NETWORK', description: 'Wired and wireless connectivity.', skills: ['NETWORK'], status: 'ACTIVE' },
  { name: 'DATABASE', description: 'Database connectivity and data service issues.', skills: ['DATABASE'], status: 'ACTIVE' },
  { name: 'CLOUD', description: 'Campus cloud service access.', skills: ['CLOUD'], status: 'ACTIVE' },
  { name: 'SECURITY', description: 'IT security concerns and access protection.', skills: ['SECURITY'], status: 'ACTIVE' },
  { name: 'AUTHENTICATION', description: 'Account sign-in and session problems.', skills: ['AUTHENTICATION'], status: 'ACTIVE' },
  { name: 'APPLICATION', description: 'Campus application functionality.', skills: ['APPLICATION'], status: 'ACTIVE' },
  { name: 'STORAGE', description: 'Storage devices and data availability.', skills: ['HARDWARE', 'DATABASE'], status: 'ACTIVE' },
  { name: 'OTHER', description: 'Issues requiring initial technical assessment.', skills: ['APPLICATION'], status: 'ACTIVE' },
];

export const slaPolicies = [
  { id: 'SLA-101', priority: 'P1', responseMinutes: 5, resolutionMinutes: 30, response: '5 minutes', resolution: '30 minutes', status: 'ACTIVE' },
  { id: 'SLA-102', priority: 'P2', responseMinutes: 15, resolutionMinutes: 120, response: '15 minutes', resolution: '2 hours', status: 'ACTIVE' },
  { id: 'SLA-103', priority: 'P3', responseMinutes: 60, resolutionMinutes: 480, response: '1 hour', resolution: '8 hours', status: 'ACTIVE' },
  { id: 'SLA-104', priority: 'P4', responseMinutes: 240, resolutionMinutes: 1440, response: '4 hours', resolution: '24 hours', status: 'ACTIVE' },
];

export const investigationNotes = [
  { id: 'NOTE-101', incidentId: 'INC-1005', timestamp: '2026-10-24T15:55:00', technicianId: 'T102', visibility: 'INTERNAL', note: 'Reproduced the payment error; checking application logs.' },
  { id: 'NOTE-102', incidentId: 'INC-1005', timestamp: '2026-10-24T16:00:00', technicianId: 'T103', visibility: 'STUDENT_VISIBLE', note: 'Database access is being checked; gateway timeouts remain under investigation.' },
];

export const studentResponses = [
  { id: 'REPLY-101', incidentId: 'INC-1005', reporterId: 'S101', requestedInformation: 'Exact error message', message: 'Please share the message shown after attempting payment.', response: 'The page shows "Payment gateway timed out" after I click Pay.', timestamp: '2026-10-24T15:58:00' },
];

export const supportRequests = [
  { id: 'INFO-101', incidentId: 'INC-1005', technicianId: 'T102', requestedAt: '2026-10-24T15:56:00', message: studentResponses[0].message },
  { id: 'INFO-102', incidentId: 'INC-1006', technicianId: 'T101', requestedAt: '2026-10-22T08:50:00', message: 'Please provide the exact error message and the time you could not open the course materials.' },
];

export const auditLogs = [
  ...demoIncidents.map((incident) => ({ id: `CREATE-${incident.id}`, timestamp: incident.createdAt, userId: incident.reporterId, incidentId: incident.id, action: 'Incident Created', previous: '—', next: 'NEW', description: 'Fictional incident created in the sample history.' })),
  ...demoIncidents.filter((incident) => incident.assignedAt && incident.id !== 'INC-1005').map((incident) => ({ id: `ASSIGN-${incident.id}`, timestamp: incident.assignedAt, userId: 'A101', incidentId: incident.id, action: 'Technician Assigned', previous: incident.id === 'INC-1002' ? 'T103' : 'Unassigned', next: incident.primaryTechnicianId, description: `${incident.primaryTechnicianId} became primary owner in the sample history.` })),
  { id: 'AUD-01', timestamp: '2026-11-01T09:20:00', userId: 'A101', incidentId: 'INC-1003', action: 'Incident Classified', previous: 'NEW', next: 'CLASSIFIED', description: 'Classified as Authentication.' },
  { id: 'AUD-02', timestamp: '2026-10-24T15:46:00', userId: 'A101', incidentId: 'INC-1005', action: 'Priority Calculated', previous: 'Unclassified', next: 'P1', description: 'Seeded priority outcome; no frontend calculation.' },
  { id: 'AUD-03', timestamp: '2026-10-24T15:47:00', userId: 'A101', incidentId: 'INC-1005', action: 'Technician Assigned', previous: 'Unassigned', next: 'T102', description: 'T102 became primary owner in the sample history.' },
  { id: 'AUD-04', timestamp: '2026-10-22T08:44:00', userId: 'T101', incidentId: 'INC-1006', action: 'Incident Acknowledged', previous: 'ASSIGNED', next: 'ACKNOWLEDGED', description: 'Primary technician acknowledged the incident.' },
  { id: 'AUD-05', timestamp: '2026-10-24T15:49:00', userId: 'T102', incidentId: 'INC-1005', action: 'Investigation Started', previous: 'ACKNOWLEDGED', next: 'IN_PROGRESS', description: 'Application log investigation started.' },
  { id: 'AUD-06', timestamp: '2026-10-24T16:00:00', userId: 'A101', incidentId: 'INC-1005', action: 'Collaborator Added', previous: 'No collaborators', next: 'T103', description: 'Database investigation assigned to T103.' },
  { id: 'AUD-07', timestamp: '2026-10-24T16:16:00', userId: 'A101', incidentId: 'INC-1005', action: 'SLA Breached', previous: 'AT_RISK', next: 'BREACHED', description: 'Pre-seeded resolution breach.' },
  { id: 'AUD-08', timestamp: '2026-10-28T15:30:00', userId: 'T102', incidentId: 'INC-1001', action: 'Incident Resolved', previous: 'IN_PROGRESS', next: 'RESOLVED', description: 'Approved software installed.' },
  { id: 'AUD-09', timestamp: '2026-10-20T15:00:00', userId: 'A101', incidentId: 'INC-1007', action: 'Incident Closed', previous: 'VERIFIED', next: 'CLOSED', description: 'Student confirmed restored ERP access.' },
  ...transferRequests.flatMap((request) => [
    { id: `${request.id}-requested`, timestamp: request.requestedAt, userId: request.currentTechnicianId, incidentId: request.incidentId, action: 'Transfer Requested', previous: request.currentTechnicianId, next: request.suggestedTechnicianId, description: request.reason },
    ...(request.decidedAt ? [{ id: `${request.id}-decision`, timestamp: request.decidedAt, userId: request.status === 'CANCELLED' ? request.currentTechnicianId : 'A101', incidentId: request.incidentId, action: `Transfer ${request.status.toLowerCase()}`, previous: 'PENDING', next: request.status, description: request.decision }] : []),
  ]),
  { id: 'AUD-10', timestamp: '2026-10-22T08:52:00', userId: 'A101', incidentId: 'INC-1006', action: 'Collaborator Added', previous: 'No collaborators', next: 'T104', description: 'Approved CR-102; primary owner and SLA unchanged.' },
  ...investigationNotes.map((note) => ({ id: `AUD-${note.id}`, timestamp: note.timestamp, userId: note.technicianId, incidentId: note.incidentId, action: 'Note Added', previous: '—', next: note.visibility, description: note.note })),
  { id: 'AUD-11', timestamp: '2026-10-29T11:30:00', userId: 'S104', incidentId: 'INC-1009', action: 'Incident Verified', previous: 'RESOLVED', next: 'VERIFIED', description: 'Student confirmed connectivity in the fictional history.' },
  { id: 'AUD-12', timestamp: '2026-10-20T14:45:00', userId: 'S103', incidentId: 'INC-1007', action: 'Incident Verified', previous: 'RESOLVED', next: 'VERIFIED', description: 'Student confirmed restored ERP access.' },
  ...demoIncidents.filter((incident) => incident.slaStatus === 'AT_RISK').map((incident) => ({ id: `WARNING-${incident.id}`, timestamp: incident.slaEvaluatedAt, userId: 'A101', incidentId: incident.id, action: 'SLA Warning', previous: 'ON_TRACK', next: 'AT_RISK', description: `Incident ${incident.slaWarning}` })),
  ...demoIncidents.filter((incident) => incident.resolvedAt && incident.id !== 'INC-1001').map((incident) => ({ id: `RESOLVE-${incident.id}`, timestamp: incident.resolvedAt, userId: incident.primaryTechnicianId, incidentId: incident.id, action: 'Incident Resolved', previous: 'IN_PROGRESS', next: 'RESOLVED', description: incident.resolution })),
].map((record) => ({ ...record, actionType: record.action.toUpperCase().replaceAll(' ', '_') })).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

export const isActive = (incident) => !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(incident.status);
export function technicianWorkload(id, incidents = demoIncidents) {
  const primary = incidents.filter((incident) => incident.primaryTechnicianId === id);
  const collaborating = incidents.filter((incident) => incident.collaborators.some((member) => member.technicianId === id));
  const participating = incidents.filter((incident) => incident.primaryTechnicianId === id || incident.collaborators.some((member) => member.technicianId === id));
  const active = participating.filter(isActive);
  const activePrimary = primary.filter(isActive).length;
  const activeCollaboration = collaborating.filter(isActive).length;
  return { primary, collaborating, participating, active, activePrimary, activeCollaboration, total: activePrimary + activeCollaboration, resolved: primary.filter((incident) => !isActive(incident)).length };
}

export const relatedIncidentExamples = [
  { id: 'RELATED-101', incidentIds: ['INC-1004', 'INC-1009'], status: 'Potentially related — shared Wi-Fi service; different locations and dates' },
];

export const recommendationExamples = [
  { incidentId: 'INC-1003', technicianId: 'T101', explanation: 'Authentication skills match the reported category. The current sample profile is available with 2 of 3 active slots occupied.' },
];

export const adminNotifications = [
  ...demoIncidents.filter((incident) => isActive(incident) && incident.priority === 'P1').map((incident) => ({ id: `ADMIN-CRITICAL-${incident.id}`, type: 'CRITICAL_INCIDENT', incidentId: incident.id, target: 'incident', referenceId: incident.id, title: 'Critical incident reported', message: incident.title, timestamp: incident.createdAt })),
  ...demoIncidents.filter((incident) => ['AT_RISK', 'BREACHED'].includes(incident.slaStatus)).map((incident) => ({ id: `ADMIN-SLA-${incident.id}`, type: incident.slaStatus === 'BREACHED' ? 'SLA_BREACHED' : 'SLA_WARNING', incidentId: incident.id, target: 'incident', referenceId: incident.id, title: incident.slaStatus === 'BREACHED' ? 'SLA breached' : 'SLA approaching', message: `Incident ${incident.slaWarning} Review the frozen SLA snapshot.`, timestamp: incident.slaEvaluatedAt })),
  ...transferRequests.filter((request) => request.status === 'PENDING').map((request) => ({ id: `ADMIN-${request.id}`, type: 'TRANSFER_PENDING', incidentId: request.incidentId, target: 'transfer', referenceId: request.id, title: 'Transfer request pending', message: request.reason, timestamp: request.requestedAt })),
  ...collaborationRequests.filter((request) => request.status === 'PENDING').map((request) => ({ id: `ADMIN-${request.id}`, type: 'COLLABORATION_PENDING', incidentId: request.incidentId, target: 'collaboration', referenceId: request.id, title: 'Collaboration request pending', message: request.reason, timestamp: request.requestedAt })),
  ...demoIncidents.filter((incident) => incident.escalation).map((incident) => ({ id: `ADMIN-ESCALATION-${incident.id}`, type: 'INCIDENT_ESCALATED', incidentId: incident.id, target: 'incident', referenceId: incident.id, title: 'Incident escalated', message: incident.escalation.reason, timestamp: incident.escalation.escalatedAt })),
  { id: 'ADMIN-WORKLOAD-T102', type: 'TECHNICIAN_OVERLOADED', target: 'technician', referenceId: 'T102', title: 'Historical technician overload', message: 'At the seeded event time, T102 held INC-1005 and INC-1001 against an illustrative capacity of 1. INC-1001 was later resolved; the current active count is 1.', timestamp: '2026-10-28T11:12:00' },
  { id: 'ADMIN-SERVICE-101', type: 'SERVICE_DISRUPTION', incidentId: 'INC-1004', target: 'incident', referenceId: 'INC-1004', title: 'Service disruption reported', message: 'Campus Wi-Fi is degraded in the shared service snapshot. Review the library connectivity report.', timestamp: '2026-11-02T10:30:00' },
];

export const knowledgeArticles = [
  { id: 'KB-101', title: 'Campus Wi-Fi Authentication Problems', category: 'NETWORK', relatedService: 'Campus Wi-Fi', keywords: ['wireless', 'authentication', 'connection', 'access point'], problem: 'A device cannot authenticate or maintain a campus Wi-Fi connection.', steps: ['Confirm the selected campus network and check whether other devices are affected.', 'Reconnect using the institution-approved sign-in process; never share passwords.', 'Record the location, time and error message for the campus support team.'], relatedIncidentIds: ['INC-1004', 'INC-1009'], updatedAt: '2026-11-02', approvalStatus: 'APPROVED' },
  { id: 'KB-102', title: 'Student Portal Login Issues', category: 'AUTHENTICATION', relatedService: 'Student Portal', keywords: ['login', 'session', 'ERP', 'browser'], problem: 'The student portal rejects sign-in or ends the session unexpectedly.', steps: ['Check the official portal address and record the exact error.', 'Retry in a fresh browser session after signing out.', 'If the error persists, provide its timestamp to support without sharing credentials.'], relatedIncidentIds: ['INC-1003', 'INC-1007'], updatedAt: '2026-11-02', approvalStatus: 'APPROVED' },
  { id: 'KB-103', title: 'Lab Computer Network Troubleshooting', category: 'HARDWARE', relatedService: 'Lab Computers', keywords: ['ethernet', 'cable', 'computer', 'connectivity'], problem: 'A lab workstation loses network access or becomes unavailable during use.', steps: ['Record the workstation ID and whether nearby computers are affected.', 'Check the visible network cable connection without opening the equipment.', 'Ask the lab technician to inspect the workstation and document the outcome.'], relatedIncidentIds: ['INC-1002'], updatedAt: '2026-11-02', approvalStatus: 'APPROVED' },
  { id: 'KB-104', title: 'Software Installation Problems', category: 'SOFTWARE', relatedService: 'Lab Computers', keywords: ['installer', 'package', 'license', 'application'], problem: 'An approved course application fails to install or launch.', steps: ['Confirm the application and version required for the course.', 'Record the installation error and ask support to check the approved package.', 'Have an authorized technician perform the installation and verify that the application launches.'], relatedIncidentIds: ['INC-1001'], updatedAt: '2026-10-29', approvalStatus: 'APPROVED' },
  { id: 'KB-105', title: 'Email Access and Configuration', category: 'APPLICATION', relatedService: 'Email Services', keywords: ['mail', 'inbox', 'account', 'configuration'], problem: 'Campus email is unavailable in a browser or configured client.', steps: ['Check whether official webmail is accessible.', 'Record whether the issue affects sending, receiving or signing in.', 'Ask support to confirm the approved client configuration; do not share passwords or verification codes.'], relatedIncidentIds: [], updatedAt: '2026-11-01', approvalStatus: 'APPROVED' },
  { id: 'KB-106', title: 'Library Network Connectivity', category: 'NETWORK', relatedService: 'Library Services', keywords: ['library', 'wireless', 'coverage', 'internet'], problem: 'Library users cannot maintain a reliable network connection.', steps: ['Record the floor, seating area and time of the connection issue.', 'Check whether the problem also affects nearby users.', 'Provide the location and observed errors to the network support team for assessment.'], relatedIncidentIds: ['INC-1004'], updatedAt: '2026-11-02', approvalStatus: 'APPROVED' },
];

// Seeded notification history only; UI actions do not generate or send notifications.
export const technicianNotifications = [
  { id: 'NT-101', technicianId: 'T101', type: 'INCIDENT_ASSIGNED', incidentId: 'INC-1002', title: 'Lab incident assigned', message: 'You became the primary technician for the lab computer incident.', timestamp: '2026-10-30T14:28:00', read: false },
  { id: 'NT-102', technicianId: 'T102', type: 'INCIDENT_UPDATED', incidentId: 'INC-1005', title: 'Investigation started', message: 'The payment incident entered investigation in the sample history.', timestamp: '2026-10-24T15:49:00', read: true },
  { id: 'NT-103', technicianId: 'T101', type: 'SLA_WARNING', incidentId: 'INC-1006', title: 'Resolution deadline approaching', message: 'The LMS incident is at risk at its recorded SLA snapshot time.', timestamp: '2026-10-22T10:25:00', read: false },
  { id: 'NT-104', technicianId: 'T101', type: 'SLA_BREACHED', incidentId: 'INC-1002', title: 'Response SLA breached', message: 'The response deadline passed without an acknowledgment in the sample record.', timestamp: '2026-10-30T14:36:00', read: false },
  { id: 'NT-105', technicianId: 'T104', type: 'TRANSFER_REQUEST', incidentId: 'INC-1005', title: 'Transfer suggested', message: 'TR-101 suggests you as a receiving technician. No transfer has been approved.', timestamp: '2026-10-24T16:25:00', read: false },
  { id: 'NT-106', technicianId: 'T101', type: 'TRANSFER_APPROVED', incidentId: 'INC-1002', title: 'Historical transfer approved', message: 'TR-102 was approved in the fictional history; you became primary owner.', timestamp: '2026-10-30T14:28:00', read: true },
  { id: 'NT-107', technicianId: 'T101', type: 'TRANSFER_REJECTED', incidentId: 'INC-1006', title: 'Historical transfer rejected', message: 'TR-103 was rejected; primary ownership remained with you.', timestamp: '2026-10-22T08:48:00', read: true },
  { id: 'NT-108', technicianId: 'T104', type: 'COLLABORATION_REQUEST', incidentId: 'INC-1005', title: 'Collaboration requested', message: 'CR-101 requests network assistance. The invitation is still pending.', timestamp: '2026-10-24T16:26:00', read: false },
  { id: 'NT-109', technicianId: 'T101', type: 'COLLABORATION_ACCEPTED', incidentId: 'INC-1006', title: 'Collaborator joined', message: 'Demo Technician Four accepted CR-102 in the fictional history.', timestamp: '2026-10-22T08:52:00', read: true },
  { id: 'NT-110', technicianId: 'T102', type: 'STUDENT_RESPONSE', incidentId: 'INC-1005', title: 'Student supplied the error message', message: 'REPLY-101 includes the payment gateway timeout message.', timestamp: '2026-10-24T15:58:00', read: false },
  { id: 'NT-111', technicianId: 'T102', type: 'INCIDENT_ESCALATED', incidentId: 'INC-1005', title: 'Payment incident escalated', message: 'The seeded escalation requested system administrator intervention.', timestamp: '2026-10-24T16:20:00', read: false },
  { id: 'NT-112', technicianId: 'T102', type: 'INCIDENT_RESOLVED', incidentId: 'INC-1001', title: 'Software incident resolved', message: 'The approved package was installed. Verification has not yet been recorded.', timestamp: '2026-10-28T15:30:00', read: true },
];

export const studentNotifications = [
  ...demoIncidents.map((incident) => ({ id: `ST-CREATE-${incident.id}`, studentId: incident.reporterId, incidentId: incident.id, type: 'INCIDENT_CREATED', title: 'Incident reported', message: incident.title, timestamp: incident.createdAt, read: false })),
  ...demoIncidents.filter((incident) => incident.assignedAt).map((incident) => ({ id: `ST-ASSIGN-${incident.id}`, studentId: incident.reporterId, incidentId: incident.id, type: 'INCIDENT_ASSIGNED', title: 'Technician assigned', message: `${incident.assignedTechnician} is the primary technician.`, timestamp: incident.assignedAt, read: false })),
  ...supportRequests.map((request) => ({ id: `ST-${request.id}`, studentId: demoIncidents.find((incident) => incident.id === request.incidentId).reporterId, incidentId: request.incidentId, type: 'INFORMATION_REQUESTED', title: 'Support requested information', message: request.message, timestamp: request.requestedAt, read: false })),
  ...investigationNotes.filter((note) => note.visibility === 'STUDENT_VISIBLE').map((note) => ({ id: `ST-${note.id}`, studentId: demoIncidents.find((incident) => incident.id === note.incidentId).reporterId, incidentId: note.incidentId, type: 'INCIDENT_UPDATED', title: 'Support progress update', message: note.note, timestamp: note.timestamp, read: false })),
  ...demoIncidents.filter((incident) => incident.resolvedAt).map((incident) => ({ id: `ST-RESOLVE-${incident.id}`, studentId: incident.reporterId, incidentId: incident.id, type: 'INCIDENT_RESOLVED', title: 'Incident resolved in sample history', message: incident.resolution, timestamp: incident.resolvedAt, read: false })),
  ...demoIncidents.filter((incident) => incident.status === 'RESOLVED').map((incident) => ({ id: `ST-VERIFY-${incident.id}`, studentId: incident.reporterId, incidentId: incident.id, type: 'AWAITING_VERIFICATION', title: 'Resolution awaiting verification', message: 'Review the resolution and prepare your confirmation or explanation.', timestamp: incident.resolvedAt, read: false })),
  ...auditLogs.filter((event) => event.action === 'Incident Closed').map((event) => ({ id: `ST-${event.id}`, studentId: demoIncidents.find((incident) => incident.id === event.incidentId).reporterId, incidentId: event.incidentId, type: 'INCIDENT_CLOSED', title: 'Incident closed in sample history', message: 'View the recorded resolution and provide feedback.', timestamp: event.timestamp, read: false })),
];
