package com.bits.itsm.testsupport;

import com.bits.itsm.event.EventBus;
import com.bits.itsm.event.EventType;
import com.bits.itsm.event.IncidentEvent;
import com.bits.itsm.event.IncidentObserver;
import com.bits.itsm.incident.Incident;
import com.bits.itsm.incident.IncidentStatus;
import com.bits.itsm.support.IncidentLookup;
import com.bits.itsm.support.IncidentSnapshot;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Shared helpers for the unit tests (no Spring, no database). */
public final class TestData {

    public static final Instant T0 = Instant.parse("2026-11-14T10:00:00Z");
    public static final Long REPORTER = 101L;
    public static final Long TECH = 201L;
    public static final Long ADMIN = 301L;

    private TestData() {
    }

    /** Builder for snapshots so each test only states what matters to it. */
    public static final class Snap {
        private final Long id;
        private Incident.Priority priority;
        private IncidentStatus status;
        private final Instant createdAt;
        private Incident.ItService service = Incident.ItService.STUDENT_PORTAL;
        private String title;
        private String description;
        private Long reporterId = REPORTER;
        private Long technicianId;
        private Instant acknowledgedAt;
        private Instant resolvedAt;

        private Snap(long id, Incident.Priority priority, IncidentStatus status, Instant createdAt) {
            this.id = id;
            this.priority = priority;
            this.status = status;
            this.createdAt = createdAt;
            this.title = "Title " + id;
            this.description = "Description " + id;
        }

        public static Snap of(long id, Incident.Priority priority, IncidentStatus status, Instant createdAt) {
            return new Snap(id, priority, status, createdAt);
        }

        public Snap service(Incident.ItService s) { this.service = s; return this; }
        public Snap text(String title, String description) { this.title = title; this.description = description; return this; }
        public Snap tech(Long t) { this.technicianId = t; return this; }
        public Snap reporter(Long r) { this.reporterId = r; return this; }
        public Snap status(IncidentStatus s) { this.status = s; return this; }
        public Snap ack(Instant t) { this.acknowledgedAt = t; return this; }
        public Snap resolved(Instant t) { this.resolvedAt = t; return this; }

        public IncidentSnapshot build() {
            return new IncidentSnapshot(id, title, description, Incident.Category.NETWORK, service, priority, status,
                    reporterId, technicianId, createdAt, acknowledgedAt, resolvedAt);
        }
    }

    public static IncidentSnapshot snapshot(long id, Incident.Priority p, IncidentStatus s, Instant created) {
        return Snap.of(id, p, s, created).build();
    }

    public static IncidentSnapshot described(long id, Incident.ItService service, String title, String description) {
        return Snap.of(id, Incident.Priority.P2, IncidentStatus.NEW, T0).service(service).text(title, description).build();
    }

    public static EventBus busWith(IncidentObserver... observers) {
        return new EventBus(List.of(observers));
    }

    public static long count(Recorder r, EventType type) {
        return r.events.stream().filter(e -> e.type() == type).count();
    }

    public static IncidentEvent event(EventType type, long incidentId) {
        return IncidentEvent.of(type, incidentId, null, null, "A", "B", "details");
    }

    /** Observer that just remembers what it saw. */
    public static class Recorder implements IncidentObserver {
        public final List<IncidentEvent> events = new ArrayList<>();

        @Override
        public void onEvent(IncidentEvent event) {
            events.add(event);
        }
    }

    /** In-memory stand-in for the incident database. */
    public static class FakeLookup implements IncidentLookup {
        private final Map<Long, IncidentSnapshot> store = new LinkedHashMap<>();
        private List<Long> admins = List.of(ADMIN);

        public FakeLookup with(IncidentSnapshot... incidents) {
            for (IncidentSnapshot i : incidents) {
                store.put(i.id(), i);
            }
            return this;
        }

        public FakeLookup admins(Long... ids) {
            this.admins = List.of(ids);
            return this;
        }

        @Override
        public Optional<IncidentSnapshot> findById(Long id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public List<IncidentSnapshot> findAll() {
            return new ArrayList<>(store.values());
        }

        @Override
        public List<Long> adminIds() {
            return admins;
        }
    }
}
