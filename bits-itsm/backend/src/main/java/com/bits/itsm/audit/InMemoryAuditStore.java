package com.bits.itsm.audit;

import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/** Default store. Records are lost on restart; replace with a database-backed AuditStore for persistence. */
@Component
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
