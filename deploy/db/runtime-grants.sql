-- Run with the migration owner after migrations; never with application credentials.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO shiwei_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON accounts,profiles,favorites,credentials,operations,quota,erasures,revocations,app_sessions,user_consents TO shiwei_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO shiwei_app;
