package com.bits.itsm.user;

import java.util.HashSet;
import java.util.Set;
import jakarta.persistence.*;

@Entity
@DiscriminatorValue("TECHNICIAN")
public class Technician extends User {
    public enum Availability { AVAILABLE, BUSY, UNAVAILABLE }
    @ElementCollection
    @CollectionTable(name = "technician_skills", joinColumns = @JoinColumn(name = "technician_id"),
            uniqueConstraints = @UniqueConstraint(columnNames = {"technician_id", "skill"}))
    @Enumerated(EnumType.STRING) @Column(name = "skill", nullable = false)
    private Set<TechnicianSkill> skills = new HashSet<>();
    @Enumerated(EnumType.STRING) private Availability availability = Availability.AVAILABLE;
    @Column(columnDefinition = "integer default 5") private int maxWorkload = 5;

    protected Technician() { }

    public Technician(String name, String email, String passwordHash, String specialization) {
        super(name, email, passwordHash);
        skills.add(TechnicianSkill.valueOf(specialization));
    }

    public Set<TechnicianSkill> getSkills() { return Set.copyOf(skills); }
    public Availability getAvailability() { return availability; }
    public int getMaxWorkload() { return maxWorkload; }
    public boolean isAvailable() { return availability == Availability.AVAILABLE; }
    public void setAvailable(boolean available) { availability = available ? Availability.AVAILABLE : Availability.UNAVAILABLE; }
    public boolean canReceive(long workload) { return isEnabled() && isAvailable() && workload < maxWorkload; }
    public void configureAssignment(Set<TechnicianSkill> skills, Availability availability, int maxWorkload) {
        if (skills == null || skills.isEmpty() || skills.stream().anyMatch(java.util.Objects::isNull) || availability == null || maxWorkload < 1 || maxWorkload > 100) throw new IllegalArgumentException("Provide skills, availability and a capacity of 1–100.");
        this.skills.clear(); this.skills.addAll(skills); this.availability = availability; this.maxWorkload = maxWorkload;
    }
    @Override
    public Role getRole() { return Role.TECHNICIAN; }
}
