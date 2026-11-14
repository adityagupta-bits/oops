package com.bits.itsm.user;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

@Entity
@DiscriminatorValue("ADMIN")
public class Administrator extends User {
    @Column(length = 100)
    private String responsibility;

    protected Administrator() { }

    public Administrator(String name, String email, String passwordHash, String responsibility) {
        super(name, email, passwordHash);
        this.responsibility = responsibility;
    }

    public String getResponsibility() { return responsibility; }
    @Override
    public Role getRole() { return Role.ADMIN; }
}
