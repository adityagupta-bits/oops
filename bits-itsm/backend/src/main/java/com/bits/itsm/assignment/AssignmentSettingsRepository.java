package com.bits.itsm.assignment;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;

public interface AssignmentSettingsRepository extends JpaRepository<AssignmentSettings, Long> {
    @Modifying @Query(value = "insert into assignment_settings(id, strategy) values (1, 'SKILL_BASED') on conflict (id) do nothing", nativeQuery = true)
    void initialize();
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select s from AssignmentSettings s where s.id = 1")
    AssignmentSettings lock();
}
