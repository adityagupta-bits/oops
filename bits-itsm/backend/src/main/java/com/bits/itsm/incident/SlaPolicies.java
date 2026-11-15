package com.bits.itsm.incident;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SlaPolicies implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    private final SlaPolicyRepository policies;
    public SlaPolicies(JdbcTemplate jdbc, SlaPolicyRepository policies) { this.jdbc = jdbc; this.policies = policies; }
    @Override @Transactional public void run(ApplicationArguments args) {
        jdbc.update("insert into sla_policies(priority,response_minutes,resolution_minutes) values ('P1',5,30),('P2',15,120),('P3',60,480),('P4',240,1440) on conflict (priority) do nothing");
    }
    public void capture(Incident incident) {
        incident.captureSla(policies.findById(incident.getPriority()).orElseThrow(() -> new IllegalStateException("SLA policy is missing.")));
    }
}
