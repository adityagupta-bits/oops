package com.bits.itsm.audit;

import java.util.List;

/** Repository-style contract for audit persistence. Swap in a JPA implementation for the database. */
public interface AuditStore {
    void save(AuditRecord record);

    /** Newest first. */
    List<AuditRecord> findAll();

    /** Newest first. */
    List<AuditRecord> findByIncident(Long incidentId);
}
