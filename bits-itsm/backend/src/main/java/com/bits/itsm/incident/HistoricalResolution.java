package com.bits.itsm.incident;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly=true)
public class HistoricalResolution {
    private final IncidentService incidents;
    private final JdbcTemplate jdbc;
    public HistoricalResolution(IncidentService incidents, JdbcTemplate jdbc) { this.incidents=incidents; this.jdbc=jdbc; }
    public record Estimate(int sampleSize, long minutes) {}
    public Optional<Estimate> estimate(Long id, String email) {
        var current=incidents.get(id,email); // Existing incident ownership and role authorization.
        if(current.affectedService()==null || current.category()==null || current.priority()==null || current.priority()==Incident.Priority.PENDING) return Optional.empty();
        var durations=jdbc.queryForList("""
            select extract(epoch from (resolved_at-created_at))/60.0
            from incidents where id<>? and affected_service=? and category=? and priority=?
            and status in ('RESOLVED','VERIFIED','CLOSED') and resolved_at>created_at
            and length(trim(coalesce(resolution_summary,'')))>0
            and not exists(select 1 from incident_history h where h.incident_id=incidents.id
                and h.action in ('CLOSED_WITHDRAWN','CLOSED_INVALID','CLOSED_DUPLICATE'))
            order by resolved_at desc, id desc limit 7
            """, Double.class,id,current.affectedService().name(),current.category().name(),current.priority().name());
        return median(durations);
    }
    public static Optional<Estimate> median(List<Double> durations) {
        if(durations.size()<5 || durations.size()>7 || durations.stream().anyMatch(d -> d==null || !Double.isFinite(d) || d<=0)) return Optional.empty();
        var sorted=durations.stream().sorted().toList();
        int n=sorted.size();
        double median=n%2==1? sorted.get(n/2):(sorted.get(n/2-1)+sorted.get(n/2))/2;
        long unit=median<60?5:median<180?15:median<720?30:60;
        return Optional.of(new Estimate(n,Math.max(unit,Math.round(median/unit)*unit)));
    }
}
