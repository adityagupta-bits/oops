package com.bits.itsm.auth;

import com.bits.itsm.user.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService implements UserDetailsService {
    private final UserRepository users;

    public AuthService(UserRepository users) { this.users = users; }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) {
        if (!EmailValidator.isValid(email)) throw new UsernameNotFoundException("Invalid credentials");
        var user = users.findByEmail(EmailValidator.normalize(email))
                .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
        return new VersionedPrincipal(user);
    }
}
