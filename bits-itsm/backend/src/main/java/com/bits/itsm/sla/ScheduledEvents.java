package com.bits.itsm.sla;

import com.bits.itsm.event.*;
import com.bits.itsm.escalation.EscalationRecord;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScheduledEvents {
    private final JdbcTemplate jdbc;
    private final EventBus bus;
    public ScheduledEvents(JdbcTemplate jdbc, EventBus bus) { this.jdbc = jdbc; this.bus = bus; }

    @Transactional
    public void publishOnce(String key, IncidentEvent event) {
        // This table is written with SQL so the database can ignore duplicate events.
        int inserted = jdbc.update("insert into scheduled_events(id, incident_id, type, next_level, description, occurred_at) values (?, ?, ?, ?, ?, ?) on conflict (id) do nothing",
                key, event.incidentId(), event.type().name(), event.next(), event.description(), java.sql.Timestamp.from(event.timestamp()));
        if (inserted == 1) bus.publish(event);
    }

    public List<EscalationRecord> escalations() {
        return jdbc.query("select distinct on (incident_id) incident_id, next_level, description, occurred_at from scheduled_events where type = 'INCIDENT_ESCALATED' order by incident_id, occurred_at desc, id desc",
                (row, index) -> new EscalationRecord(row.getLong(1), row.getString(2), row.getString(3), row.getTimestamp(4).toInstant()));
    }
}
