const fs = require('fs');
const path = require('path');

const features = [
  'auth', 'users', 'organizations', 'memberships', 'teams', 'invitations',
  'workspaces', 'permissions', 'platform', 'billing', 'communication',
  'projects', 'delivery/individual', 'delivery/structured', 'delivery/reviews',
  'delivery/evidence', 'delivery/acceptance', 'delivery/progress',
  'integrations', 'repositories', 'notifications', 'reports', 'analytics',
  'support', 'incidents', 'security', 'audit', 'settings'
];

for (const f of features) {
  const dir = path.join('src/features', f);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const indexFile = path.join(dir, 'index.ts');
  if (!fs.existsSync(indexFile)) {
    const rawName = f.split('/').pop();
    const camel = rawName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
    const content = `// ProWise ${rawName} feature module
export interface ${pascal}Config {
  enabled: boolean;
  name: string;
}

export const ${camel}FeatureConfig: ${pascal}Config = {
  enabled: true,
  name: "${rawName}",
};
`;
    fs.writeFileSync(indexFile, content, 'utf8');
  }
}
console.log('All feature modules created successfully.');

