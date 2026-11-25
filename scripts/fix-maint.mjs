import fs from "fs";
import path from "path";

const maintPath = path.resolve("C:/BizzFly_Project/ProWise/frontend/src/store/maintenance-store.ts");
let code = fs.readFileSync(maintPath, "utf8");

const startIdx = code.indexOf("const SEED_MAINTENANCE_ITEMS: MaintenanceWindowItem[] = [");
const endIdx = code.indexOf("interface MaintenanceStoreState {");

if (startIdx !== -1 && endIdx !== -1) {
  code = code.slice(0, startIdx) + "const SEED_MAINTENANCE_ITEMS: MaintenanceWindowItem[] = [];\n\n" + code.slice(endIdx);
}

code = code.replace("platformWideMaintenanceActive: true, // mnt-84 is active", "platformWideMaintenanceActive: false,");
code = code.replace('name: "prowise-maintenance-store-v2"', 'name: "prowise-maintenance-store-v4"');
code = code.replaceAll("Arthur Pendelton", "Super Admin");
code = code.replaceAll("prowise.io", "prowise.com");

fs.writeFileSync(maintPath, code, "utf8");
console.log("Fixed maintenance-store.ts successfully.");
