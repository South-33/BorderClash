import { spawnSync } from "node:child_process";

const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
const result = spawnSync(shell, [
  "-NoProfile", "-ExecutionPolicy", "Bypass",
  "-File", "tests/automation/run-cycle.test.ps1",
  ...process.argv.slice(2),
], { stdio: "inherit", windowsHide: true });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
