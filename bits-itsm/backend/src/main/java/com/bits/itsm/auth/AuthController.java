package com.bits.itsm.auth;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import com.bits.itsm.user.Role;
import com.bits.itsm.user.User;
import com.bits.itsm.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository contexts;
    private final SessionAuthenticationStrategy sessions;
    private final UserRepository users;
    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.security.crypto.password.PasswordEncoder passwords;

    public record Registration(String name, String email, String password, String confirmPassword) {
        @Override public String toString() { return "Registration[redacted]"; }
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@RequestBody Registration input) {
        String email = EmailValidator.normalize(input.email());
        String password = input.password();
        if (input.name() == null || input.name().isBlank() || input.name().trim().length() > 100
                || password == null || !PasswordPolicy.valid(password)
                || password.getBytes(StandardCharsets.UTF_8).length > 72
                || !password.matches("(?s).*[A-Za-z].*") || !password.matches("(?s).*[0-9].*")
                || !password.equals(input.confirmPassword())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Enter your name and matching passwords with at least 12 characters, a letter and a number (maximum 72 bytes)."));
        }
        if (users.existsByEmail(email)) return duplicateEmail();
        try {
            // Public registration always creates a student, regardless of client fields.
            users.saveAndFlush(new com.bits.itsm.user.Student(input.name().trim(), email, passwords.encode(password), null));
        } catch (org.springframework.dao.DataIntegrityViolationException duplicate) {
            return duplicateEmail();
        }
        return ResponseEntity.status(201).body(Map.of("message", "Registration successful. Please sign in."));
    }

    private ResponseEntity<Map<String, String>> duplicateEmail() {
        return ResponseEntity.status(409).body(Map.of("message", "This email is already registered."));
    }

    public AuthController(AuthenticationManager authenticationManager, SecurityContextRepository contexts,
            SessionAuthenticationStrategy sessions, UserRepository users) {
        this.authenticationManager = authenticationManager;
        this.contexts = contexts;
        this.sessions = sessions;
        this.users = users;
    }

    public record LoginRequest(@NotBlank @Size(max = 254) String email,
            @NotBlank @Size(max = 72) String password, Role role) {
        public LoginRequest(String email, String password) { this(email, password, null); }
        @Override
        public String toString() { return "LoginRequest[credentials redacted]"; }
    }

    public record Account(Long id, String name, String email, Role role) {
        public boolean getPasswordManagement() { return true; }
        static Account from(User user) {
            return new Account(user.getId(), user.getName(), user.getEmail(), user.getRole());
        }
    }

    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken token) {
        return Map.of("headerName", token.getHeaderName(), "token", token.getToken());
    }

    @PostMapping("/login")
    public Account login(@Valid @RequestBody LoginRequest credentials,
            HttpServletRequest request, HttpServletResponse response) {
        String email = EmailValidator.normalize(credentials.email());
        if (credentials.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("Password exceeds BCrypt's input limit.");
        }
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(email, credentials.password()));
        Account account = account(authentication);
        if (credentials.role() != null && credentials.role() != account.role()) {
            throw new LoginRoleException();
        }
        sessions.onAuthentication(authentication, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        // Explicitly persist authentication so the session cookie works on later requests.
        contexts.saveContext(context, request, response);
        return account;
    }

    @GetMapping("/me")
    public Account me(Authentication authentication) { return account(authentication); }

    private Account account(Authentication authentication) {
        User user = users.findByEmail(authentication.getName())
                .filter(User::isEnabled).orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        return Account.from(user);
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<Map<String, String>> authenticationFailure() {
        return ResponseEntity.status(401).body(Map.of("message", "Invalid email or password."));
    }

    // Only report a role mismatch after the password has been verified.
    private static class LoginRoleException extends AuthenticationException {
        LoginRoleException() { super("Choose the login option matching your account role."); }
    }

    @ExceptionHandler(LoginRoleException.class)
    ResponseEntity<Map<String, String>> wrongLoginRole() {
        return ResponseEntity.status(401).body(Map.of("message", "Your credentials are valid, but this is the wrong login option. Select Student, Technician or Administrator to match your account."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> invalidInput(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Map.of("message", error.getMessage()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    ResponseEntity<Map<String, String>> invalidRequest() {
        return ResponseEntity.badRequest().body(Map.of("message",
                "Enter a valid institutional email without surrounding whitespace and a password of at most 72 bytes."));
    }
}
