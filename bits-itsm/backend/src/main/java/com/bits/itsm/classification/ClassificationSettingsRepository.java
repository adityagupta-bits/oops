package com.bits.itsm.classification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

public interface ClassificationSettingsRepository extends JpaRepository<ClassificationSettings, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ClassificationSettings s where s.id = 1")
    ClassificationSettings lock();
}
