package com.bits.itsm.incident;

import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface IncidentRepository extends JpaRepository<Incident, Long> {
    List<Incident> findByReporterIdOrderByCreatedAtDesc(Long reporterId);
    List<Incident> findByAssignedTechnicianIdOrderByCreatedAtDesc(Long technicianId);
    List<Incident> findAllByOrderByCreatedAtDesc();
    @Query("select distinct i from Incident i left join i.collaborators c where i.assignedTechnician.id = :id or c.technician.id = :id order by i.createdAt desc")
    List<Incident> findTeamIncidents(Long id);
    @Query("select i.assignedTechnician.id, i.status, i.priority, count(i) from Incident i where i.assignedTechnician is not null group by i.assignedTechnician.id, i.status, i.priority")
    List<Object[]> primaryWorkloads();
    @Query("select c.technician.id, i.status, i.priority, count(distinct i.id) from Incident i join i.collaborators c group by c.technician.id, i.status, i.priority")
    List<Object[]> collaborationWorkloads();
    // Serialize lifecycle actions and feedback submissions for one incident.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Incident i where i.id = :id")
    Optional<Incident> findForUpdate(Long id);
}
