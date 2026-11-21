package com.bits.itsm.classification;

import com.bits.itsm.incident.Incident.Level;
import jakarta.persistence.*;

@Entity
@Table(name = "classification_settings")
public class ClassificationSettings {
    @Id
    private Long id = 1L;

    @Column(nullable = false)
    private boolean autoClassifyEnabled = true;

    @Column(nullable = false, columnDefinition = "text")
    private String highUrgencyKeywords = "exam, midterm, quiz, submission, deadline, today, urgent, emergency, immediately, presentation";

    @Column(nullable = false, columnDefinition = "text")
    private String lowUrgencyKeywords = "routine, whenever, next week, question, query, inquiry, minor, cosmetic";

    @Column(nullable = false, columnDefinition = "text")
    private String highImpactKeywords = "all students, everyone, entire campus, whole hostel, campus-wide, all users, lab-wide, all computers";

    @Column(nullable = false, columnDefinition = "text")
    private String mediumImpactKeywords = "several students, multiple users, group, department, team, classroom, lab";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Level defaultImpact = Level.LOW;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Level defaultUrgency = Level.MEDIUM;

    @Column(nullable = false)
    private boolean flagUncertain = true;

    public ClassificationSettings() { }

    public Long getId() { return id; }
    public boolean isAutoClassifyEnabled() { return autoClassifyEnabled; }
    public String getHighUrgencyKeywords() { return highUrgencyKeywords; }
    public String getLowUrgencyKeywords() { return lowUrgencyKeywords; }
    public String getHighImpactKeywords() { return highImpactKeywords; }
    public String getMediumImpactKeywords() { return mediumImpactKeywords; }
    public Level getDefaultImpact() { return defaultImpact; }
    public Level getDefaultUrgency() { return defaultUrgency; }
    public boolean isFlagUncertain() { return flagUncertain; }

    public void update(boolean autoClassifyEnabled, String highUrgencyKeywords, String lowUrgencyKeywords,
                       String highImpactKeywords, String mediumImpactKeywords,
                       Level defaultImpact, Level defaultUrgency, boolean flagUncertain) {
        this.autoClassifyEnabled = autoClassifyEnabled;
        this.highUrgencyKeywords = java.util.Objects.requireNonNull(highUrgencyKeywords, "High urgency keywords required").trim();
        this.lowUrgencyKeywords = java.util.Objects.requireNonNull(lowUrgencyKeywords, "Low urgency keywords required").trim();
        this.highImpactKeywords = java.util.Objects.requireNonNull(highImpactKeywords, "High impact keywords required").trim();
        this.mediumImpactKeywords = java.util.Objects.requireNonNull(mediumImpactKeywords, "Medium impact keywords required").trim();
        this.defaultImpact = java.util.Objects.requireNonNull(defaultImpact, "Default impact required");
        this.defaultUrgency = java.util.Objects.requireNonNull(defaultUrgency, "Default urgency required");
        this.flagUncertain = flagUncertain;
    }
}
