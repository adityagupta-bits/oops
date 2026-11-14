package com.bits.itsm.assignment;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransferRequestRepository extends JpaRepository<TransferRequest, Long> {
    boolean existsByIncidentIdAndStatus(Long incidentId, AssignmentRequest.Status status);
    List<TransferRequest> findAllByOrderByRequestedAtDesc();
    List<TransferRequest> findByPrimaryTechnicianIdOrProposedTechnicianIdOrderByRequestedAtDesc(Long primaryId, Long proposedId);
}
