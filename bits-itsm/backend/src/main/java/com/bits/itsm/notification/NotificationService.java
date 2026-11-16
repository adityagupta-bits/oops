package com.bits.itsm.notification;

import com.bits.itsm.event.IncidentEvent;
import com.bits.itsm.event.IncidentObserver;
import com.bits.itsm.support.IncidentLookup;
import com.bits.itsm.support.IncidentSnapshot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Observer that decides who should hear about an event and pushes it through every channel.
 * The person who caused the event is never notified about their own action.
 * Channels are injected as a list, so a new NotificationChannel bean is picked up automatically.
 */
@Component
public class NotificationService implements IncidentObserver {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final IncidentLookup lookup;
    private final List<NotificationChannel> channels;

    public NotificationService(IncidentLookup lookup, List<NotificationChannel> channels) {
        this.lookup = lookup;
        this.channels = List.copyOf(channels);
    }

    @Override
    public void onEvent(IncidentEvent e) {
        RuntimeException failure = null;
        for (Long recipient : recipientsFor(e)) {
            Notification n = NotificationFactory.create(e, recipient);
            for (NotificationChannel channel : channels) {
                try {
                    channel.send(n);
                } catch (RuntimeException ex) {
                    failure = ex;
                    log.error("Channel {} failed for {}", channel.name(), n.id(), ex);
                }
            }
        }
        if (failure != null) throw failure;
    }

    Set<Long> recipientsFor(IncidentEvent e) {
        Optional<IncidentSnapshot> incident = lookup.findById(e.incidentId());
        Long reporter = incident.map(IncidentSnapshot::reporterId).orElse(null);
        Long technician = incident.map(IncidentSnapshot::technicianId).orElse(null);
        List<Long> admins = lookup.adminIds();

        Set<Long> to = new LinkedHashSet<>(e.recipients());
        if (e.action() != null && (e.action().startsWith("TRANSFER_") || e.action().startsWith("COLLABOR") || e.action().startsWith("INTERNAL_"))) {
            to.addAll(admins); add(to, technician);
            to.remove(e.actorId());
            return to;
        }
        switch (e.type()) {
            case INCIDENT_CREATED -> {
                add(to, reporter);
                to.addAll(admins);
            }
            case INCIDENT_CLASSIFIED, PRIORITY_CHANGED, INCIDENT_ACKNOWLEDGED, INCIDENT_RESOLVED -> add(to, reporter);
            case INCIDENT_ASSIGNED, INCIDENT_CLOSED, INCIDENT_UPDATED -> add(to, reporter, technician);
            case SLA_WARNING, SLA_BREACHED, INCIDENT_ESCALATED -> {
                add(to, technician);
                to.addAll(admins);
            }
            case DUPLICATE_DETECTED -> to.addAll(admins);
        }
        if (e.actorId() != null) {
            to.remove(e.actorId());
        }
        return to;
    }

    private static void add(Set<Long> set, Long... ids) {
        for (Long id : ids) {
            if (id != null) {
                set.add(id);
            }
        }
    }
}
