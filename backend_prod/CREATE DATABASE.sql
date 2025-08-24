CREATE DATABASE vidyai;
CREATE USER vidyaidbuser WITH PASSWORD 'vidyaidbuserpassw0rd';
ALTER ROLE vidyaidbuser SET client_encoding TO 'utf8';
ALTER ROLE vidyaidbuser SET default_transaction_isolation TO 'read committed';
ALTER ROLE vidyaidbuser SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE vidyai TO vidyaidbuser;
\c vidyai
GRANT ALL ON SCHEMA public TO vidyaidbuser;
\q
