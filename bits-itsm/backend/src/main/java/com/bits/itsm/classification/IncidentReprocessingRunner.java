package com.bits.itsm.classification;

import com.bits.itsm.incident.*;
import com.bits.itsm.assignment.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/** Explicit operator-only recovery; disabled unless exact incident IDs are supplied at startup. */
@Component
@ConditionalOnProperty(name="bitsolve.reprocess.incident-ids")
public class IncidentReprocessingRunner implements ApplicationRunner {
    private final IncidentRepository incidents;
    private final IncidentClassificationService classification;
    private final AssignmentService assignments;
    private final AssignmentSettingsRepository settings;
    private final TransactionTemplate transactions;
    private final String ids;
    public IncidentReprocessingRunner(IncidentRepository incidents, IncidentClassificationService classification,
            AssignmentService assignments, AssignmentSettingsRepository settings, org.springframework.transaction.PlatformTransactionManager manager,
            @Value("${bitsolve.reprocess.incident-ids}") String ids) {
        this.incidents=incidents; this.classification=classification; this.assignments=assignments;
        this.settings=settings; this.transactions=new TransactionTemplate(manager); this.ids=ids;
    }
    @Override public void run(ApplicationArguments args) {
        for(String value:ids.split(",")) {
            long id=Long.parseLong(value.trim());
            transactions.executeWithoutResult(status -> {
                settings.lock();
                var incident=incidents.findForUpdate(id).orElseThrow();
                if(incident.getStatus()!=IncidentStatus.NEW || !incident.isNeedsClassificationReview()
                        || incident.getAssignedTechnician()!=null) return;
                incident.record(incident.getReporter(),"AUTOMATIC_REPROCESSING","Operator requested re-evaluation with updated classification rules; original report retained.",InvestigationNote.Visibility.STUDENT_VISIBLE);
                classification.processSubmission(incident,incident.getReporter());
                incidents.flush();
                if(incident.isAutoClassified()) assignments.assignPending(id);
            });
        }
    }
}
