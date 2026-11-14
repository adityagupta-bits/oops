package com.bits.itsm.incident;

import java.time.Instant;
import com.bits.itsm.user.User;
import jakarta.persistence.*;

@Entity @Table(name = "investigation_notes")
public class InvestigationNote {
    public enum Visibility { INTERNAL, STUDENT_VISIBLE }
    public enum Kind { NOTE, INFORMATION_REQUEST, STUDENT_REPLY }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private Incident incident;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private User author;
    @Column(nullable = false, length = 2000) private String content;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Visibility visibility;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Kind kind;
    protected InvestigationNote() { }
    InvestigationNote(Incident incident, User author, String content, Visibility visibility, Kind kind) {
        this.incident = incident; this.author = author; this.content = Incident.text(content, 1, 2000);
        this.visibility = java.util.Objects.requireNonNull(visibility); this.kind = kind;
    }
    public Long getId() { return id; }
    public User getAuthor() { return author; }
    public String getContent() { return content; }
    public Instant getCreatedAt() { return createdAt; }
    public Visibility getVisibility() { return visibility; }
    public Kind getKind() { return kind; }
}
