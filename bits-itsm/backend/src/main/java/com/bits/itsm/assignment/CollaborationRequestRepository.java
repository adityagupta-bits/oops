package com.bits.itsm.assignment;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollaborationRequestRepository extends JpaRepository<CollaborationRequest, Long> {
    boolean existsByIncidentIdAndProposedTechnicianIdAndStatus(Long incidentId, Long technicianId, AssignmentRequest.Status status);
    List<CollaborationRequest> findAllByOrderByRequestedAtDesc();
    List<CollaborationRequest> findByPrimaryTechnicianIdOrProposedTechnicianIdOrderByRequestedAtDesc(Long primaryId, Long proposedId);
}
