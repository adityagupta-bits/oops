package com.bits.itsm.support;

import java.util.List;
import java.util.Optional;

/**
 * Narrow read-only view of incident storage used by the services layer.
 * RepositoryIncidentLookup adapts the JPA repositories to this contract (Adapter pattern).
 */
public interface IncidentLookup {
    Optional<IncidentSnapshot> findById(Long id);

    List<IncidentSnapshot> findAll();

    /** Ids of all enabled administrators (they receive operational notifications). */
    List<Long> adminIds();
}
