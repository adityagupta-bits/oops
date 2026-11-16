# Services and intelligence

The integrated application provides persistent audit, in-app notifications, student Gmail email, SLA monitoring, escalation, duplicate detection and keyword categorization.

Observer, Strategy, Factory and Adapter examples are described in the root README. In-memory persistence stand-ins are confined to tests. Gmail is implemented but requires SMTP credentials; delivery has not been tested against Gmail. Similarity and categorization use deterministic rules, not external AI models.

Student email now uses the persisted Gmail outbox in EmailChannel. Only the three reporter lifecycle messages are sent after commit; in-app notification delivery is unchanged. See the root README for configuration and retry behavior. Legacy simulated email rows are not sent.
