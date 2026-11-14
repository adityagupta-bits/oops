package com.bits.itsm.incident;

import java.time.Instant;
import com.bits.itsm.user.Student;
import jakarta.persistence.*;

@Entity @Table(name = "incident_feedback")
public class IncidentFeedback {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(unique = true, nullable = false) private Incident incident;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private Student student;
    @Column(nullable = false) private int rating;
    @Column(length = 1000) private String comment;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    protected IncidentFeedback() { }
    IncidentFeedback(Incident incident, Student student, int rating, String comment) {
        if (rating < 1 || rating > 5) throw new IllegalArgumentException("Rating must be between 1 and 5.");
        this.incident = incident; this.student = student; this.rating = rating;
        this.comment = comment == null ? "" : Incident.text(comment, 0, 1000);
    }
    public int getRating() { return rating; }
    public String getComment() { return comment; }
    public Instant getCreatedAt() { return createdAt; }
}
