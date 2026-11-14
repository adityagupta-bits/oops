package com.bits.itsm.user;

import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    @Query("select distinct t from Technician t left join fetch t.skills order by t.id")
    List<Technician> findTechnicians();
}
