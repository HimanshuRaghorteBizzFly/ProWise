const fs = require('fs');

const layouts = [
  'src/app/(platform)/super-admin/layout.tsx',
  'src/app/(platform)/platform-operator/layout.tsx',
  'src/app/(workspace)/org/[orgId]/layout.tsx',
  'src/app/(workspace)/org/[orgId]/owner/layout.tsx',
  'src/app/(workspace)/org/[orgId]/admin/layout.tsx',
  'src/app/(workspace)/org/[orgId]/manager/layout.tsx',
  'src/app/(workspace)/org/[orgId]/lead/layout.tsx',
  'src/app/(workspace)/org/[orgId]/developer/layout.tsx',
  'src/app/(workspace)/org/[orgId]/reviewer/layout.tsx',
  'src/app/(workspace)/org/[orgId]/viewer/layout.tsx',
];

for (const l of layouts) {
  const content = `import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
`;
  fs.writeFileSync(l, content, 'utf8');
}
console.log('All 10 layouts created successfully.');

