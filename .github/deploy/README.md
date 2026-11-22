# Deploying production from GitHub Actions

`.github/workflows/deploy-production.yml` deploys the live server without a
laptop: GitHub's runner connects to the server over SSH and runs
`remote-deploy.sh` there. Start it under **Actions → Deploy production → Run
workflow** (or have a Claude cloud session start it).

- `mode: inspect` changes nothing: it prints the tools on the server, the pm2
  processes with their folders, how far each checkout is behind `master`, and
  whether the database URL is found. Run this first after setup.
- `mode: deploy`, `target: both` runs the backend and then the storefront:
  1. backend: refuse if the server checkout has uncommitted changes, fast-forward
     to `origin/master`, `pg_dump` the database to `~/backups/deploy/` (the 10
     newest are kept), `yarn install`, `yarn build`, `npx medusa db:migrate` from
     `.medusa/server`, `pm2 restart`, wait for `/health`
  2. storefront: the same checks, `yarn install`, `yarn build`, `pm2 restart`,
     wait for it to answer

  Any failing step stops the run, so the storefront is never built when the
  backend did not come back. The log prints the commit before and after and the
  `pg_restore` command for the backup.

## One-time setup

1. **A key for GitHub.** On the server (IONOS's web console works, no laptop
   needed), as the user that owns the checkouts and pm2:

   ```bash
   ssh-keygen -t ed25519 -N "" -C github-actions-deploy -f ~/.ssh/github_deploy
   cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
   cat ~/.ssh/github_deploy          # copy into the DEPLOY_SSH_KEY secret, then:
   rm ~/.ssh/github_deploy
   for f in /etc/ssh/ssh_host_*_key.pub; do echo "212.227.28.191 $(cut -d' ' -f1,2 "$f")"; done
                                     # copy into the DEPLOY_KNOWN_HOSTS secret
   ```

2. **Secrets** (repository → Settings → Secrets and variables → Actions →
   Secrets): `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST`
   (`212.227.28.191`), `DEPLOY_USER` (e.g. `root`), and `DEPLOY_PORT` only if
   SSH is not on 22. Paste them in GitHub yourself; never in a chat.

3. **Variables** (same page → Variables): `BACKEND_DIR` and `STOREFRONT_DIR`
   (absolute paths of the two checkouts), `STOREFRONT_PM2` (the storefront's pm2
   name) and, if it is not `medusa-backend`, `BACKEND_PM2`. An `inspect` run
   lists the pm2 names and folders if you are unsure.

4. **Environment.** The job runs in the `production` environment, which GitHub
   creates on the first run. Add yourself as a required reviewer there
   (Settings → Environments → production) if every deploy should wait for a
   click.

The server must accept SSH from GitHub's runners (any IP on port 22 or
`DEPLOY_PORT`), and its checkouts must be able to `git fetch` from GitHub, as
they already do for manual deploys.
