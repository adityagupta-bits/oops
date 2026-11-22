package com.bits.itsm;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.junit.jupiter.api.Assertions.*;

/** Uses newly created databases only; never cleans or migrates the configured database. */
@EnabledIfEnvironmentVariable(named = "BITSOLVE_DB_TESTS", matches = "true")
class PostgresMigrationTests {
    @Test void upgradesV1RecordsThroughEveryMigration() { upgrade("1"); }
    @Test void upgradesV5WithoutChangingConfiguredCriticalityOrHistory() { upgrade("5"); }

    private void upgrade(String version) {
        String source = System.getenv("BITSOLVE_TEST_DB_URL");
        assertNotNull(source, "Configure a disposable PostgreSQL server with CREATEDB permission.");
        String user = System.getenv().getOrDefault("DB_USER", System.getenv().getOrDefault("DB_USERNAME", "postgres"));
        String password = System.getenv("DB_PASSWORD");
        String database = "bitsolve_migration_" + UUID.randomUUID().toString().replace("-", "");
        String url = source.replaceFirst("/[^/?]+(?:\\?.*)?$", "/" + database);
        assertNotEquals(source, url);
        var server = new JdbcTemplate(new DriverManagerDataSource(source, user, password));
        server.execute("create database " + database);
        try {
            Flyway.configure().dataSource(url, user, password).target(version).load().migrate();
            var jdbc = new JdbcTemplate(new DriverManagerDataSource(url, user, password));
            jdbc.update("insert into app_users(id,enabled,role,student_number,password_hash,name,email) values(900,true,'STUDENT','TEST-900','test-only-hash','Migration Student','migration@hyderabad.bits-pilani.ac.in')");
            jdbc.update("insert into catalog_entries(id,kind,code,label,enabled,criticality) values('SERVICE:CAMPUS_WIFI','SERVICE','CAMPUS_WIFI','Configured Wi-Fi',true,'HIGH'),('SERVICE:EMAIL','SERVICE','EMAIL','Configured Email',true,'MEDIUM')");
            jdbc.update("insert into assignment_settings(id,strategy) values(1,'LOAD_BASED')");
            jdbc.update("insert into priority_settings(id,strategy,impact_weight,urgency_weight,criticality_weight) values(1,'WEIGHTED',0.5,0.3,0.2)");
            jdbc.update("insert into sla_policies(priority,response_minutes,resolution_minutes) values('P2',19,155) on conflict(priority) do update set response_minutes=19,resolution_minutes=155");
            jdbc.update("insert into incidents(id,reporter_id,title,description,category,affected_service,impact,urgency,priority,status,created_at,updated_at,criticality,response_target_minutes,resolution_target_minutes,response_deadline,resolution_deadline) values(900,900,'Saved incident','Preserve this report and its captured deadlines.','NETWORK','CAMPUS_WIFI','HIGH','MEDIUM','P2','CLASSIFIED','2026-01-01 00:00:00+00','2026-01-01 00:00:00+00','HIGH',7,99,'2026-01-01 00:07:00+00','2026-01-01 01:39:00+00')");
            jdbc.update("insert into incident_history(actor_id,incident_id,created_at,description,action,visibility) values(900,900,current_timestamp,'Historical report','CREATED','STUDENT_VISIBLE')");
            var incident = jdbc.queryForMap("select * from incidents where id=900");
            var account = jdbc.queryForMap("select * from app_users where id=900");
            if (version.equals("1")) {
                jdbc.update("insert into incidents(id,reporter_id,title,description,category,affected_service,impact,urgency,priority,status,created_at,updated_at) values(901,900,'Legacy incident','A legacy record without SLA snapshots.','NETWORK','CAMPUS_WIFI','HIGH','MEDIUM','P2','CLASSIFIED','2026-01-01 00:00:00+00','2026-01-01 00:00:00+00')");
            }
            var flyway = Flyway.configure().dataSource(url, user, password).load();
            flyway.migrate();
            flyway.validate();
            assertEquals(0, flyway.migrate().migrationsExecuted);
            var migratedIncident = jdbc.queryForMap("select * from incidents where id=900");
            incident.forEach((column, value) -> assertEquals(value, migratedIncident.get(column), column));
            assertEquals(false, migratedIncident.get("needs_classification_review"));
            assertEquals(false, migratedIncident.get("auto_classified"));
            assertNull(migratedIncident.get("classification_notes"));
            assertEquals(account, jdbc.queryForMap("select * from app_users where id=900"));
            assertEquals(1, jdbc.queryForObject("select count(*) from incident_history where incident_id=900", Integer.class));
            assertEquals("LOAD_BASED", jdbc.queryForObject("select strategy from assignment_settings where id=1", String.class));
            assertEquals("WEIGHTED", jdbc.queryForObject("select strategy from priority_settings where id=1", String.class));
            assertEquals(0.5, jdbc.queryForObject("select impact_weight from priority_settings where id=1", Double.class));
            assertEquals(0.3, jdbc.queryForObject("select urgency_weight from priority_settings where id=1", Double.class));
            assertEquals(0.2, jdbc.queryForObject("select criticality_weight from priority_settings where id=1", Double.class));
            assertEquals("HIGH", jdbc.queryForObject("select criticality from catalog_entries where code='CAMPUS_WIFI'", String.class));
            assertEquals("MEDIUM", jdbc.queryForObject("select criticality from catalog_entries where code='EMAIL'", String.class));
            assertEquals(155, jdbc.queryForObject("select resolution_minutes from sla_policies where priority='P2'", Integer.class));
            assertEquals(11, jdbc.queryForObject("select count(*) from flyway_schema_history where success", Integer.class));
            assertEquals(20, jdbc.queryForObject("select count(*) from problem_templates", Integer.class));
            assertEquals(1, jdbc.queryForObject("select count(*) from classification_settings where id=1", Integer.class));
            assertNotNull(jdbc.queryForObject("select keywords from catalog_entries where code='CAMPUS_WIFI'", String.class));
            if (version.equals("1")) {
                assertEquals(19, jdbc.queryForObject("select response_target_minutes from incidents where id=901", Integer.class));
                assertEquals(155 * 60, jdbc.queryForObject("select extract(epoch from resolution_deadline-created_at)::int from incidents where id=901", Integer.class));
            }
            jdbc.update("insert into catalog_entries(id,kind,code,label,enabled) values('SERVICE:OTHER','SERVICE','OTHER','Unconfigured',false)");
            assertNull(jdbc.queryForObject("select criticality from catalog_entries where code='OTHER'", String.class));
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () -> jdbc.update("update incidents set reporter_id=999999 where id=900"));
        } finally {
            // database is a generated identifier created above, never a supplied database name.
            server.execute("drop database " + database + " with (force)");
        }
    }
}
