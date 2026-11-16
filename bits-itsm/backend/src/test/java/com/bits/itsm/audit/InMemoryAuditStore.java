package com.bits.itsm.audit;

import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/** Test double used by observer unit tests. Production uses JpaAuditStore. */
public class InMemoryAuditStore implements AuditStore {

    private static final Comparator<AuditRecord> NEWEST_FIRST =
            Comparator.comparing(AuditRecord::timestamp).thenComparing(AuditRecord::id).reversed();

    private final List<AuditRecord> records = new CopyOnWriteArrayList<>();

    @Override
    public void save(AuditRecord record) {
        records.add(record);
    }

    @Override
    public List<AuditRecord> findAll() {
        return records.stream().sorted(NEWEST_FIRST).toList();
    }

    @Override
    public List<AuditRecord> findByIncident(Long incidentId) {
        return records.stream()
                .filter(r -> r.incidentId().equals(incidentId))
                .sorted(NEWEST_FIRST)
                .toList();
    }
}
