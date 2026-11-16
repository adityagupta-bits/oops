package com.bits.itsm.audit;

import java.util.List;

/** Audit persistence contract, implemented by JpaAuditStore in the application. */
public interface AuditStore {
    void save(AuditRecord record);

    /** Newest first. */
    List<AuditRecord> findAll();

    /** Newest first. */
    List<AuditRecord> findByIncident(Long incidentId);
}
