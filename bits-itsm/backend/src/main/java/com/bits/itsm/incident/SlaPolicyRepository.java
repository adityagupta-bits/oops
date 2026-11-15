package com.bits.itsm.incident;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SlaPolicyRepository extends JpaRepository<SlaPolicy, Incident.Priority> { }
