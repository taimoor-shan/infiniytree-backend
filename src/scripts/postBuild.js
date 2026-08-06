const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const MEDUSA_SERVER_PATH = path.join(process.cwd(), '.medusa', 'server');

// Check if .medusa/server exists - if not, build process failed
if (!fs.existsSync(MEDUSA_SERVER_PATH)) {
  throw new Error('.medusa/server directory not found. This indicates the Medusa build process failed. Please check for build errors.');
}

// Copy yarn.lock
fs.copyFileSync(
  path.join(process.cwd(), 'yarn.lock'),
  path.join(MEDUSA_SERVER_PATH, 'yarn.lock')
);

// Copy production start wrapper. package.json is copied into .medusa/server
// with the same start script, so the wrapper must exist in both roots.
fs.copyFileSync(
  path.join(process.cwd(), 'start-production.js'),
  path.join(MEDUSA_SERVER_PATH, 'start-production.js')
);

// Copy .env if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  fs.copyFileSync(
    envPath,
    path.join(MEDUSA_SERVER_PATH, '.env')
  );
}

// Copy runtime assets (fonts + static media) into the built server.
// In production, process.chdir(.medusa/server) is called before Medusa starts,
// so assets must live under .medusa/server/ for process.cwd()-relative resolution.
const copyDirIfExists = (srcName) => {
  const src = path.join(process.cwd(), srcName)
  const dest = path.join(MEDUSA_SERVER_PATH, srcName)
  if (!fs.existsSync(src)) {
    console.log(`postBuild: skipping ${srcName} (not found)`)
    return
  }
  fs.cpSync(src, dest, { recursive: true })
  console.log(`postBuild: copied ${srcName}/ → .medusa/server/${srcName}/`)
}
copyDirIfExists('fonts')
copyDirIfExists('static')

// Install dependencies
console.log('Installing dependencies in .medusa/server...');
execSync('yarn install --frozen-lockfile', { 
  cwd: MEDUSA_SERVER_PATH,
  stdio: 'inherit'
});
