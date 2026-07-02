const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")

// Admin build lives in .medusa/server/public/admin/ after `medusa build`
const serverDir = path.join(process.cwd(), ".medusa", "server")
const adminIndex = path.join(serverDir, "public", "admin", "index.html")

if (!fs.existsSync(adminIndex)) {
  console.error(
    "Admin build not found at .medusa/server/public/admin/index.html. " +
    "Run 'yarn build' before starting production."
  )
  process.exit(1)
}

process.chdir(serverDir)
console.log("Starting Medusa server from", serverDir)

const child = spawn("npx", ["medusa", "start", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: process.env,
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
