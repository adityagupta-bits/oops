package com.bits.itsm.assignment;

import java.time.Instant;
import com.bits.itsm.incident.Incident;
import com.bits.itsm.user.*;
import jakarta.persistence.*;

@MappedSuperclass
public abstract class AssignmentRequest {
    public enum Status { PENDING, APPROVED, REJECTED, CANCELLED }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private Incident incident;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private Technician primaryTechnician;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private Technician proposedTechnician;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Status status = Status.PENDING;
    @Column(nullable = false) private Instant requestedAt = Instant.now();
    @ManyToOne(fetch = FetchType.LAZY) private User reviewedBy;
    private Instant reviewedAt;
    @Column(length = 2000) private String reviewNotes;
    protected AssignmentRequest() { }
    protected AssignmentRequest(Incident incident, Technician target) {
        this.incident = incident; this.primaryTechnician = incident.getAssignedTechnician(); this.proposedTechnician = target;
    }
    public void requirePending() { if (status != Status.PENDING) throw new IllegalStateException("This request has already been finalized."); }
    public void review(Status status, User actor, String notes) {
        requirePending();
        if (status == Status.PENDING) throw new IllegalArgumentException("Choose a final decision.");
        if (notes == null || notes.isBlank() || notes.length() > 2000) throw new IllegalArgumentException("Review notes are required (maximum 2000 characters).");
        this.status = status; reviewedBy = actor; reviewedAt = Instant.now(); reviewNotes = notes.trim();
    }
    public Long getId() { return id; }
    public Incident getIncident() { return incident; }
    public Technician getPrimaryTechnician() { return primaryTechnician; }
    public Technician getProposedTechnician() { return proposedTechnician; }
    public Status getStatus() { return status; }
    public Instant getRequestedAt() { return requestedAt; }
    public User getReviewedBy() { return reviewedBy; }
    public Instant getReviewedAt() { return reviewedAt; }
    public String getReviewNotes() { return reviewNotes; }
    protected static String text(String text) {
        if (text == null || text.isBlank() || text.length() > 2000) throw new IllegalArgumentException("Provide text of 1–2000 characters.");
        return text.trim();
    }
}
