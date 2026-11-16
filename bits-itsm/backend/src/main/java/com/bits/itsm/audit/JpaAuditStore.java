package com.bits.itsm.audit;

import jakarta.persistence.EntityManager;
import java.util.List;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository @Transactional
public class JpaAuditStore implements AuditStore {
    private final EntityManager entityManager;
    public JpaAuditStore(EntityManager entityManager) { this.entityManager = entityManager; }
    @Override public void save(AuditRecord record) { entityManager.persist(new StoredAudit(record)); }
    @Override @Transactional(readOnly = true) public List<AuditRecord> findAll() {
        return entityManager.createQuery("select a from StoredAudit a order by a.timestamp desc, a.id desc", StoredAudit.class)
                .getResultList().stream().map(StoredAudit::view).toList();
    }
    @Override @Transactional(readOnly = true) public List<AuditRecord> findByIncident(Long incidentId) {
        return entityManager.createQuery("select a from StoredAudit a where a.incidentId = :id order by a.timestamp desc, a.id desc", StoredAudit.class)
                .setParameter("id", incidentId).getResultList().stream().map(StoredAudit::view).toList();
    }
}
