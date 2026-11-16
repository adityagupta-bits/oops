package com.bits.itsm.priority;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PrioritySettingsRepository extends JpaRepository<PrioritySettings, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from PrioritySettings p where p.id = 1")
    PrioritySettings lock();
}
