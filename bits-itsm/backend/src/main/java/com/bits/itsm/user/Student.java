package com.bits.itsm.user;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

@Entity
@DiscriminatorValue("STUDENT")
public class Student extends User {
    @Column(length = 30)
    private String studentNumber;

    protected Student() { }

    public Student(String name, String email, String passwordHash, String studentNumber) {
        super(name, email, passwordHash);
        this.studentNumber = studentNumber;
    }

    public String getStudentNumber() { return studentNumber; }
    @Override
    public Role getRole() { return Role.STUDENT; }
}
