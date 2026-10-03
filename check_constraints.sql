SELECT constraint_name, constraint_type, table_name
FROM information_schema.table_constraints
WHERE table_name = 'yfp_weekly_articles'
ORDER BY constraint_name;
