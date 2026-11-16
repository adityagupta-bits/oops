package com.bits.itsm.audit;

import com.bits.itsm.event.IncidentEvent;
import com.bits.itsm.event.IncidentObserver;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/** Observer that turns every incident event into an audit record. */
@Component
public class AuditLogger implements IncidentObserver {

    private final AuditStore store;

    public AuditLogger(AuditStore store) {
        this.store = store;
    }

    @Override
    public void onEvent(IncidentEvent e) {
        String id = "AUD-" + UUID.randomUUID();
        String action = e.action() != null ? e.action() : e.type().label();
        store.save(new AuditRecord(id, e.timestamp(), e.actorId(), e.incidentId(),
                action, e.previous(), e.next(), e.description()));
    }

    public List<AuditRecord> getAll() {
        return store.findAll();
    }

    public List<AuditRecord> getByIncident(Long incidentId) {
        return store.findByIncident(incidentId);
    }
}
