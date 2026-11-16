package com.bits.itsm.user;

import com.bits.itsm.auth.EmailValidator;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "app_users")
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "role", length = 16)
public abstract class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @JsonIgnore
    @Column(nullable = false, length = 60)
    private String passwordHash;

    @Column(nullable = false)
    private boolean enabled = true;

    protected User() { }

    protected User(String name, String email, String passwordHash) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Name is required.");
        if (passwordHash == null || !passwordHash.startsWith("$2")) throw new IllegalArgumentException("A BCrypt password hash is required.");
        this.name = name;
        this.email = EmailValidator.normalize(email);
        this.passwordHash = passwordHash;
    }

    @PrePersist
    @PreUpdate
    private void normalizeEmail() {
        email = EmailValidator.normalize(email);
    }

    public Long getId() { return id; }
    public void rename(String name) {
        if (name == null || name.isBlank() || name.length() > 100) throw new IllegalArgumentException("Provide a name of 1-100 characters.");
        this.name = name.trim();
    }
    public String getName() { return name; }
    public String getEmail() { return email; }
    @JsonIgnore
    public String getPasswordHash() { return passwordHash; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    // The concrete user type determines authorization; clients cannot assign a role.
    public abstract Role getRole();
}
