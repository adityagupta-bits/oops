package com.bits.itsm.incident;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class CatalogEntryTest {
    @Test void customIdentityDoesNotRequireAnEnumAndActivationRequiresCriticality() {
        var service = CatalogEntry.service("LIBRARY_PROXY", "Library Proxy", false, null, "library proxy");
        assertEquals("SERVICE:LIBRARY_PROXY", service.getId());
        assertThrows(IllegalArgumentException.class, () -> service.update("Library Proxy", true, null, "proxy"));
        service.update("Library Proxy", true, Incident.Level.HIGH, "library proxy");
        assertTrue(service.isEnabled());
        assertEquals("LIBRARY_PROXY", service.getCode());
    }
    @Test void malformedCodesAndOversizedKeywordsAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> new ServiceCode("bad code"));
        assertThrows(IllegalArgumentException.class, () -> CatalogEntry.service("PROXY", "Proxy", false, null, "x".repeat(2001)));
    }
}
