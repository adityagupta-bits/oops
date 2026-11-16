package com.bits.itsm.intelligence;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static com.bits.itsm.incident.Incident.Category.*;

class CategorySuggesterTest {
    private final CategorySuggester suggester = new CategorySuggester();
    @Test void suggestsCategoryFromWholeKeywords() {
        assertEquals(NETWORK, suggester.suggest("WI-FI failure", "Router is offline").category());
        assertEquals(AUTHENTICATION, suggester.suggest("Password rejected", "Cannot login").category());
        assertEquals(OTHER, suggester.suggest("Monitoring", "The catalogue is wrong").category());
    }
    @Test void ambiguousAndEmptyTextRequireReview() {
        assertEquals(OTHER, suggester.suggest("Router password", "").category());
        assertEquals(OTHER, suggester.suggest(null, null).category());
    }
    @Test void supportsConfiguredKeywords() {
        suggester.setRules(java.util.Map.of(DATABASE, java.util.List.of("postgres")));
        assertEquals(DATABASE, suggester.suggest("Postgres unavailable", "").category());
    }
}
