package com.bits.itsm.assignment;

import com.bits.itsm.incident.Incident;
import com.bits.itsm.user.Technician;
import jakarta.persistence.*;

@Entity @Table(name = "transfer_requests")
public class TransferRequest extends AssignmentRequest {
    public enum Reason { DIFFERENT_SPECIALIZATION, EXCESSIVE_WORKLOAD, TECHNICIAN_UNAVAILABLE, SENIOR_ESCALATION, OTHER,
        HIGH_WORKLOAD, LACK_OF_EXPERTISE, UNAVAILABLE, INCORRECT_ASSIGNMENT, BETTER_SUITED_TECHNICIAN }
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Reason reason;
    @Column(nullable = false, length = 2000) private String handoverNotes;
    @ManyToOne(fetch = FetchType.LAZY) private Technician assignedTechnician;
    protected TransferRequest() { }
    public TransferRequest(Incident incident, Technician target, Reason reason, String handoverNotes) {
        super(incident, target); this.reason = java.util.Objects.requireNonNull(reason); this.handoverNotes = text(handoverNotes);
    }
    public Reason getReason() { return reason; }
    public String getHandoverNotes() { return handoverNotes; }
    public Technician getAssignedTechnician() { return assignedTechnician; }
    public void assignTo(Technician technician) { assignedTechnician = java.util.Objects.requireNonNull(technician); }
}
