-- Safe additive migration for automatic incident classification and review.
-- Backward-compatible: keeps all existing incidents, accounts, SLA records and audit history intact.

alter table incidents alter column affected_service drop not null;
alter table incidents alter column category drop not null;
alter table incidents alter column impact drop not null;
alter table incidents alter column urgency drop not null;

alter table incidents add column if not exists needs_classification_review boolean not null default false;
alter table incidents add column if not exists auto_classified boolean not null default false;
alter table incidents add column if not exists classification_notes varchar(2000);

alter table catalog_entries add column if not exists keywords varchar(2000);

-- Initial classification settings
create table if not exists classification_settings (
    id bigint not null primary key,
    auto_classify_enabled boolean not null default true,
    high_urgency_keywords text not null default 'exam, midterm, quiz, submission, deadline, today, urgent, emergency, immediately, presentation',
    low_urgency_keywords text not null default 'routine, whenever, next week, question, query, inquiry, minor, cosmetic',
    high_impact_keywords text not null default 'all students, everyone, entire campus, whole hostel, campus-wide, all users, lab-wide, all computers',
    medium_impact_keywords text not null default 'several students, multiple users, group, department, team, classroom, lab',
    default_impact varchar(255) not null default 'LOW',
    default_urgency varchar(255) not null default 'MEDIUM',
    flag_uncertain boolean not null default true
);

insert into classification_settings (id, auto_classify_enabled, high_urgency_keywords, low_urgency_keywords, high_impact_keywords, medium_impact_keywords, default_impact, default_urgency, flag_uncertain)
values (1, true, 'exam, midterm, quiz, submission, deadline, today, urgent, emergency, immediately, presentation', 'routine, whenever, next week, question, query, inquiry, minor, cosmetic', 'all students, everyone, entire campus, whole hostel, campus-wide, all users, lab-wide, all computers', 'several students, multiple users, group, department, team, classroom, lab', 'LOW', 'MEDIUM', true)
on conflict (id) do nothing;

-- Populate default classification keywords for existing services
update catalog_entries set keywords = 'wifi, wi-fi, eduroam, wireless, access point, ssid' where code = 'CAMPUS_WIFI' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'portal, cms, erp, grades, attendance, course registration, timetable' where code = 'STUDENT_PORTAL' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'library, book, journal, catalog, borrow, reading room' where code = 'LIBRARY' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'lab, desktop, workstation, lab computer, lab pc, monitor' where code = 'LAB_COMPUTERS' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'email, mail, inbox, outlook, gmail, webmail' where code = 'EMAIL' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'lan, ethernet, network, router, switch, dns, subnet, internet' where code = 'CAMPUS_NETWORK' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'login, password, sign in, auth, 2fa, otp, account locked, credentials' where code = 'AUTHENTICATION' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'general, other, miscellaneous' where code = 'OTHER' and (keywords is null or keywords = '');

-- Populate default classification keywords for existing categories
update catalog_entries set keywords = 'network, wi-fi, wifi, router, internet, lan, connection' where code = 'NETWORK' and kind = 'CATEGORY' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'password, login, authentication, sign in, auth, otp, 2fa' where code = 'AUTHENTICATION' and kind = 'CATEGORY' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'laptop, keyboard, monitor, printer, hardware, mouse, desktop, screen' where code = 'HARDWARE' and kind = 'CATEGORY' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'database, sql, query, postgres, tables' where code = 'DATABASE' and kind = 'CATEGORY' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'installation, software, license, app, program, install' where code = 'SOFTWARE' and kind = 'CATEGORY' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'disk, storage, backup, drive, quota' where code = 'STORAGE' and kind = 'CATEGORY' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'malware, phishing, virus, suspicious, hack, security' where code = 'SECURITY' and kind = 'CATEGORY' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'cloud, virtual machine, vm, aws, azure, gcp' where code = 'CLOUD' and kind = 'CATEGORY' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'portal, application, web app, site' where code = 'APPLICATION' and kind = 'CATEGORY' and (keywords is null or keywords = '');
update catalog_entries set keywords = 'other, misc, uncategorized' where code = 'OTHER' and kind = 'CATEGORY' and (keywords is null or keywords = '');
