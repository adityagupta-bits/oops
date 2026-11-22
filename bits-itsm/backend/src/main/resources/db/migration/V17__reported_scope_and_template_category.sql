ALTER TABLE incidents ADD COLUMN reported_affected_users integer;
ALTER TABLE incidents ADD CONSTRAINT reported_affected_users_positive CHECK (reported_affected_users > 0);
ALTER TABLE problem_templates ADD COLUMN category_code varchar(50);
ALTER TABLE problem_templates ADD CONSTRAINT template_category_code_check CHECK (category_code ~ '^[A-Z][A-Z0-9_]{1,49}$');
