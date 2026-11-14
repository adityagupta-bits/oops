package com.bits.itsm.assignment;

import java.time.Instant;
import java.util.Set;
import com.bits.itsm.incident.IncidentData.Person;
import com.bits.itsm.user.*;
import jakarta.validation.constraints.*;

public final class AssignmentData {
    private AssignmentData() { }
    public record Strategy(@NotNull AssignmentSettings.Mode strategy) { }
    public record Profile(@NotEmpty Set<@NotNull TechnicianSkill> skills, @NotNull Technician.Availability availability, @Min(1) @Max(100) int maxWorkload) { }
    public record Transfer(@NotNull @Positive Long technicianId, @NotNull TransferRequest.Reason reason, @NotBlank @Size(max = 2000) String handoverNotes) { }
    public record Collaboration(@NotNull @Positive Long technicianId, @NotNull TechnicianSkill requiredSkill,
            @NotBlank @Size(max = 2000) String reason, @NotBlank @Size(max = 2000) String responsibility) { }
    public record Review(@NotBlank @Size(max = 2000) String notes) { }
    public record RequestView(Long id, Long incidentId, String incidentTitle, Person primaryTechnician, Person proposedTechnician,
            AssignmentRequest.Status status, String reason, String handoverNotes, TechnicianSkill requiredSkill, String responsibility,
            Instant requestedAt, Person reviewedBy, Instant reviewedAt, String reviewNotes) { }
}
