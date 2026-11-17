INSERT INTO grants (
    id, org_id, membership_id, template_role_id, scope, granted_by
)
SELECT
    (
        substr(md5(random()::text || clock_timestamp()::text), 1, 8) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 9, 4) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 13, 4) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 17, 4) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 21, 12)
    )::uuid,
    m.org_id, m.id, r.id, 'ORG', m.user_id
FROM memberships m
JOIN roles r ON r.name = m.role_template AND r.is_template
WHERE m.status = 'ACTIVE'
  AND NOT EXISTS (
      SELECT 1 FROM grants g
      WHERE g.org_id = m.org_id AND g.membership_id = m.id
  );
