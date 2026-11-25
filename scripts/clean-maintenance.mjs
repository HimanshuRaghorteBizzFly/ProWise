import fs from "fs";
import path from "path";

const maintPath = path.resolve("C:/BizzFly_Project/ProWise/frontend/src/store/maintenance-store.ts");
let code = fs.readFileSync(maintPath, "utf8");

// Clear SEED_MAINTENANCE_ITEMS
code = code.replace(
  /const SEED_MAINTENANCE_ITEMS: MaintenanceWindowItem\[\] = \[[\s\S]*?\n\];\n/,
  "const SEED_MAINTENANCE_ITEMS: MaintenanceWindowItem[] = [];\n"
);

// Set platformWideMaintenanceActive to false by default
code = code.replace(
  /platformWideMaintenanceActive:\s*true,.*?\n/,
  "platformWideMaintenanceActive: false,\n"
);

// Replace Arthur Pendelton / prowise.io
code = code.replaceAll("Arthur Pendelton", "Super Admin");
code = code.replaceAll("prowise.io", "prowise.com");

// Update persist name
code = code.replace(
  'name: "prowise-maintenance-store-v2"',
  'name: "prowise-maintenance-store-v3"'
);

fs.writeFileSync(maintPath, code, "utf8");
console.log("Successfully cleaned maintenance-store.ts");
