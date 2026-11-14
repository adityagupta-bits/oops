package com.bits.itsm.assignment;

import jakarta.persistence.*;

@Entity @Table(name = "assignment_settings")
public class AssignmentSettings {
    public enum Mode { SKILL_BASED, LOAD_BASED }
    @Id private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Mode strategy;
    protected AssignmentSettings() { }
    public Mode getStrategy() { return strategy; }
    public void select(Mode strategy) { this.strategy = java.util.Objects.requireNonNull(strategy); }
}
