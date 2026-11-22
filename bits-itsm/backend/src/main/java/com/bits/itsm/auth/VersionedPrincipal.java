package com.bits.itsm.auth;

import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/** Session credential generation; never serializes account credentials to API responses. */
public final class VersionedPrincipal extends org.springframework.security.core.userdetails.User {
    private final long credentialVersion;
    public VersionedPrincipal(com.bits.itsm.user.User account) {
        super(account.getEmail(), account.getPasswordHash(), account.isEnabled(), true, true, true,
                List.of(new SimpleGrantedAuthority("ROLE_" + account.getRole().name())));
        credentialVersion = account.getCredentialVersion();
    }
    public long credentialVersion() { return credentialVersion; }
}
