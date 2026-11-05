## System Architecture

**BITSolve — Intelligent IT Service Management & Incident Resolution System**

BITSolve follows a three-tier architecture:

```text
            React Frontend
                  |
      Student | Technician | Admin
                  |
             REST API
                  |
        Java Spring Boot
                  |
     Controllers → Services
                  |
          JPA Repositories
                  |
          PostgreSQL Database
```

### Technology Stack

- **Frontend:** React, JavaScript, CSS, Vite
- **Backend:** Java, Spring Boot, Spring Security
- **Database:** PostgreSQL
- **Persistence:** Spring Data JPA / Hibernate
- **Architecture:** REST-based, layered architecture

### Key Features

- Role-based access for students, technicians, and administrators
- Incident reporting, tracking, investigation, and resolution
- Skill-based and load-based technician assignment
- Technician transfer and collaboration workflows
- SLA monitoring and escalation
- Notifications and audit history
- Incident analytics and intelligent resolution assistance

### Object-Oriented Design

The Java backend demonstrates encapsulation, inheritance, polymorphism, abstraction, interfaces, collections, exception handling, and design patterns such as Strategy and Observer.

### Development Status

Frontend prototype development is underway. Backend integration, persistent storage, and intelligent features are planned for subsequent phases.
