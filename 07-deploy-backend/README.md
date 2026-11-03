# Step 7 — Deploy the Backend

**You'll end with:** your API live at `https://YOUR-HOSTNAME/api`, served over HTTPS by Apache on your DigitalOcean droplet, running under its own unprivileged user, storing its data in MongoDB Atlas, and redeploying itself through GitHub Actions every time you push, but only if the tests pass.
**Time:** about 2 hours. Take a break between parts if you need to.

---

## What you'll learn

On your laptop, Docker Compose runs the API *and* MongoDB, and you call the API at `http://localhost:5000`. In production it looks like this:

```text
                                         your droplet (LAMP)
 browser / Bruno                        ┌───────────────────────────────────────────┐
 https://YOUR-HOSTNAME/api/... ──443──► │ Apache ──► 127.0.0.1:5000 ──► Node API    │ ──► MongoDB Atlas
                                        │ (HTTPS,      reverse proxy    (systemd,   │     (database in
                                        │  port 80/443)                 user deploy)│      the cloud)
                                        └───────────────────────────────────────────┘
 git push ──► GitHub Actions: npm test, then copy the code to /opt/cards-api and restart
```

- **MongoDB Atlas** hosts the database, so the droplet doesn't have to run one. The API only needs a different connection string.
- **An unprivileged user.** Your droplet came with only `root`, which can do anything. Day to day, the API runs as, and GitHub logs in as, a normal user called `deploy`. If something goes wrong (a bug in your code, a stolen key), the damage stays inside that one account.
- **nvm** (Node Version Manager) installs Node 26 for the `deploy` user, the same tool you may use on your laptop.
- **Node runs directly on the droplet** (no Docker), kept alive by **systemd**, the Linux service manager. systemd starts the API at boot, restarts it if it crashes, and keeps its log. The API is a **user service**: it belongs to `deploy`, who can restart it without ever needing root.
- **A reverse proxy.** The API listens only on port 5000 *inside* the droplet; the firewall never opens that port. **Apache**, already running on your LAMP droplet, receives every request on the normal web ports and passes the ones for `/api` to the API.
- **HTTPS.** Free certificates from **Let's Encrypt**, installed by **Certbot**, encrypt everything between browsers and Apache: passwords, login tokens, and card data.
- **GitHub Actions** is your deploy pipeline. On every push it runs your Step 5 tests on GitHub's computers, and only if they pass, copies the code to the droplet and restarts the service. That's **CI/CD**: *continuous integration* (test every change) and *continuous deployment* (ship every passing change).

Your laptop setup doesn't change: you still develop with `docker compose up` and the local database from Step 2.

## This step's files

```text
cards-backend/
├── .github/workflows/deploy.yml   the GitHub Actions workflow
└── deploy/
    ├── cards-api.service          the systemd service definition
    └── apache-cards.conf          the Apache site (reverse proxy, and later the frontend)
```

You'll copy them in during part 5.

## Before you start

You need:

- your **DigitalOcean LAMP droplet's IP address**, and you can log in with `ssh root@YOUR-SERVER`
- a **MongoDB Atlas** account (free tier)
- a **DuckDNS** account, or a domain name of your own (part 2)
- your `cards-backend` code pushed to GitHub, with `npm test` passing

In the commands below, replace `YOUR-SERVER` with your droplet's IP address, and `YOUR-HOSTNAME` with the hostname you set up in part 2.

## 1. Set up MongoDB Atlas

In [MongoDB Atlas](https://cloud.mongodb.com) (see Atlas's [getting started guide](https://www.mongodb.com/docs/atlas/getting-started/) if the screens differ from these steps):

1. **Create a cluster** on the **free** tier. You don't need any paid features for this course.
2. **Create a database user** (under *Database Access*) with a username and password. Avoid symbols like `@`, `:`, and `/` in the password; they have special meanings in a connection string.
3. **Allow your droplet to connect** (under *Network Access*): add your droplet's IP address. Atlas refuses connections from any address that isn't on this list.
4. **Get the connection string:** click **Connect** on your cluster, choose **Drivers**, and copy the string. It looks like:

   ```text
   mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```

   Put your user's password in place of the placeholder, and add the database name **`CardsDB`** after the `/`:

   ```text
   mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/CardsDB?retryWrites=true&w=majority
   ```

Keep this string private: it contains your database password.

### Optional: browse your Atlas data with Compass

To look at your production data with [MongoDB Compass](https://www.mongodb.com/products/compass) on your laptop, Atlas must allow **your laptop** too, not just the droplet:

1. Visit [whatismyip.com](https://www.whatismyip.com) and copy your **public IPv4 address**.
2. In Atlas, under *Network Access*, add that address as a second entry, with a comment like `my laptop`.
3. In Compass, connect with the same connection string as above.

Your public IP changes when you change networks (home, campus Wi-Fi, a coffee shop), and sometimes on its own. If Compass suddenly can't connect, check whatismyip.com again and update the entry. The droplet's entry never needs to change.

## 2. Get a hostname

HTTPS certificates are issued for **names**, like `cards-jsmith.duckdns.org`, not for IP addresses. A name also lets Apache keep your app separate from anything else on the droplet: requests for your hostname go to the Cards app, while requests for the bare IP address keep going to whatever the droplet served before (an earlier LAMP project, for example).

**[DuckDNS](https://www.duckdns.org)** gives out free hostnames:

1. Sign in (with GitHub, Google, or another listed account).
2. Type a subdomain, such as `cards-jsmith`, and click **add domain**.
3. In the **current ip** box next to it, enter your droplet's IP address and click **update ip**.

Your hostname is now `cards-jsmith.duckdns.org`. Check that it points at your droplet (it can take a minute):

```bash
$ nslookup cards-jsmith.duckdns.org
...
Address: YOUR-SERVER
```

**Have your own domain?** Use it instead: in your registrar's DNS settings, add an **A record** for a name like `cards.yourdomain.com` pointing at your droplet's IP address.

From here on, `YOUR-HOSTNAME` means this name.

## 3. Create an unprivileged user (as root)

Log in to the droplet as `root`. Everything in this part runs **on the droplet, as root**.

```bash
$ ssh root@YOUR-SERVER
```

**Create the `deploy` user.** `--disabled-password` means it has no password at all, so nobody can log in by guessing one; you'll log in with your SSH key instead.

```bash
$ adduser --disabled-password --comment "" deploy
```

**Let your SSH key log in as `deploy`.** This copies `root`'s list of allowed keys (which includes your laptop's key) to the new user, owned by that user:

```bash
$ rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

**Let `deploy` read system logs**, so it can see the API's log later:

```bash
$ usermod -aG systemd-journal deploy
```

**Let `deploy`'s services run all the time.** Besides the main copy of systemd that runs the whole machine, every user gets a personal *service manager* that runs their own **user services**, and `deploy` will run the API as one (part 5). Normally a user's service manager starts when they log in and stops when they log out, taking their services with it. **Lingering** keeps it running from boot, whether or not anyone is logged in:

```bash
$ loginctl enable-linger deploy
$ ls /var/lib/systemd/linger
deploy
```

This is the only administrator command the API's service needs. From now on, `deploy` starts, stops, and restarts its own service, with no `sudo`.

**Create the app's folders**, owned by `deploy`:

```bash
$ mkdir -p /opt/cards-api /var/www/cards
$ echo '<p>The Cards frontend arrives in Step 13.</p>' > /var/www/cards/index.html
$ chown deploy:deploy /opt/cards-api /var/www/cards /var/www/cards/index.html
```

- **`/opt/cards-api`** holds the API's code and its `.env`. It's deliberately *not* in a folder Apache serves, so nobody can download your `.env` from a browser.
- **`/var/www/cards`** is where the frontend's files will go in Step 13. For now it holds a placeholder page.

**Install rsync**, which receives files from GitHub Actions:

```bash
$ apt-get install -y rsync
```

Notice what you *don't* do: open port 5000. The LAMP droplet's firewall allows only SSH, HTTP (80), and HTTPS (443), and it stays that way.

Type `exit` to go back to your own computer.

## 4. Install Node 26 and create `.env` (as deploy)

From your computer, log in as the new user:

```bash
$ ssh deploy@YOUR-SERVER
```

The prompt now shows `deploy@...`. If SSH asks for a password instead, the key copy in part 3 didn't work; log in as root and run that `rsync` line again.

**Install nvm and Node 26:**

```bash
$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
$ source ~/.bashrc
$ nvm install 26
$ nvm alias default 26
$ node --version
v26.x.x
```

nvm installs Node inside `/home/deploy/.nvm`, so it belongs to this user only. `nvm alias default 26` makes Node 26 the version every new login uses.

**Create the `.env`:**

```bash
$ cd /opt/cards-api
$ cat > .env <<EOF
MONGODB_URI=PASTE-YOUR-ATLAS-CONNECTION-STRING-HERE
PORT=5000
JWT_SECRET=$(openssl rand -hex 48)
JWT_EXPIRES_IN=1h
EOF
$ chmod 600 .env
$ nano .env
```

In `nano`, replace `PASTE-YOUR-ATLAS-CONNECTION-STRING-HERE` with your connection string from part 1, then save (**Ctrl+O**, **Enter**) and exit (**Ctrl+X**). `JWT_SECRET` is already filled in with a new random value. `chmod 600` means only `deploy` can read the file.

Type `exit` to go back to your own computer.

## 5. Install the service

On **your computer**, copy this step's files into your project:

```bash
$ cp -r "$TUTORIALS/07-deploy-backend/files/." "$WORKSPACE/"
$ cd "$WORKSPACE/cards-backend"
```

Open `deploy/cards-api.service`:

```ini
[Service]
WorkingDirectory=/opt/cards-api
Environment=NODE_VERSION=26
Environment=NODE_ENV=production
ExecStart=%h/.nvm/nvm-exec node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

- **`WorkingDirectory`**: run from `/opt/cards-api`. `server.js` loads `.env` from that folder, as it does on your laptop.
- **`ExecStart`** and **`NODE_VERSION`**: nvm only sets itself up in *interactive* logins (through `~/.bashrc`), and systemd doesn't log in, so it can't find `node` on its own. **`nvm-exec`**, a small script that comes with nvm, loads nvm, switches to the version in `NODE_VERSION`, and then runs `node server.js`. **`%h`** is systemd's shorthand for the user's home folder, `/home/deploy`.
- **`Restart=always`**: if the API crashes, start it again after 5 seconds.
- **`WantedBy=default.target`**: start it whenever `deploy`'s service manager starts, which, thanks to lingering, is when the droplet boots.

Notice there's no `User=` line: a user service always runs as the user it belongs to, so the API can't run as root by mistake. And because port 5000 is above 1024, an ordinary user is allowed to listen on it. (Ports below 1024, like 80 and 443, are reserved for root, which is one more job Apache does for you.)

User services live in the user's own `~/.config/systemd/user` folder, so you install this one as `deploy`, not root:

```bash
$ ssh deploy@YOUR-SERVER "mkdir -p ~/.config/systemd/user"
$ scp deploy/cards-api.service deploy@YOUR-SERVER:~/.config/systemd/user/
$ ssh deploy@YOUR-SERVER "systemctl --user daemon-reload && systemctl --user enable cards-api"
Created symlink /home/deploy/.config/systemd/user/default.target.wants/cards-api.service → /home/deploy/.config/systemd/user/cards-api.service.
```

**`--user`** tells `systemctl` to talk to your own service manager instead of the machine's. `daemon-reload` makes it read the new file, and `enable` marks the service to start automatically. There's no code on the droplet yet, so it won't run until the first deploy.

## 6. Read the workflow

Open `.github/workflows/deploy.yml`. GitHub runs any workflow in `.github/workflows/` automatically.

**When it runs:**

```yaml
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
```

**Continuous integration**, on every push and pull request:

```yaml
      - uses: actions/checkout@v4          # get the code
      - uses: actions/setup-node@v4        # install Node 26, like the droplet
      - run: npm ci                        # install exact versions from package-lock.json
      - run: npm test                      # your Step 5 tests
```

These run on a fresh machine at GitHub. If a test fails, the workflow stops, and **nothing broken reaches your server**.

**Continuous deployment**, only for pushes (`if: github.event_name == 'push' ...`):

```yaml
      - name: Copy the API code to the droplet
        run: >
          rsync -az --delete --no-owner --no-group
          --exclude '.git/' --exclude '.github/' --exclude 'node_modules/'
          --exclude '.env' --exclude 'tests/' --exclude 'api-tests/' ...
          ./ "$SSH_USER@$SSH_HOST:$APP_DIR/"

      - name: Install and restart on the droplet
        run: |
          ssh ... "
            export XDG_RUNTIME_DIR=/run/user/\$(id -u)
            cd $APP_DIR
            NODE_VERSION=26 ~/.nvm/nvm-exec npm ci --omit=dev
            systemctl --user restart cards-api
            curl -fsS --retry 10 --retry-delay 2 --retry-connrefused http://localhost:5000/api/ping
          "
```

- **`rsync`** copies your code to `/opt/cards-api` over SSH, logged in as `deploy`. **`--delete`** removes files you've deleted from the repository. The **`--exclude`** patterns skip what the server doesn't need (tests, Git history, your laptop's `node_modules`), and protect what it must keep: excluded paths are never touched, so the droplet's own `.env` survives every deploy.
- **`npm ci --omit=dev`** installs only the packages the API needs to *run*, skipping nodemon, Vitest, and the in-memory test database. Commands sent over SSH like this don't load nvm either, so they use `nvm-exec` exactly as the service does.
- **`systemctl --user restart cards-api`** restarts the service with the new code. It's `deploy`'s own service, so no `sudo` is involved. **`XDG_RUNTIME_DIR`** tells `systemctl --user` where to find `deploy`'s service manager (in `/run/user/` followed by the user's number), since a command sent over SSH may not have it set. The `\$` makes the droplet work out `$(id -u)`, rather than GitHub's computer.
- The final **`curl`** asks the API for `/api/ping` *from the droplet itself*, at `localhost:5000`, retrying for up to about 20 seconds. If it never answers, the deploy is marked as **failed**, so you find out right away instead of when a user does.

The connection details come from **secrets**, which you'll add next. If they're missing, the workflow runs the tests and skips the deploy with a warning.

## 7. Give GitHub a key to your droplet

GitHub Actions logs in to your droplet with SSH, so it needs its own key. Create one **on your computer**, just for this, and allow it to log in as `deploy` (not root):

```bash
$ ssh-keygen -t ed25519 -f ~/.ssh/cards_actions -N "" -C "github-actions"
$ ssh-copy-id -i ~/.ssh/cards_actions.pub deploy@YOUR-SERVER
$ ssh -i ~/.ssh/cards_actions deploy@YOUR-SERVER "echo it works"
it works
```

`ssh-copy-id` adds the public key to `deploy`'s list of allowed keys. You'll reuse this same key for the frontend in Step 13.

On GitHub, open your **cards-backend** repository → **Settings → Secrets and variables → Actions** → **Secrets** tab, and click **New repository secret** for each:

| Name | Value |
|---|---|
| `SSH_HOST` | your droplet's IP address (no `http://`, no port) |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | the **entire** output of `cat ~/.ssh/cards_actions` (no `.pub`), from `-----BEGIN` to `END ... KEY-----` |

Secrets are hidden once saved, even from you, and GitHub masks them in logs.

## 8. Deploy

```bash
$ git add .github deploy
$ git commit -m "Step 7: deploy with GitHub Actions"
$ git push
```

On GitHub, open the **Actions** tab and click the running workflow. Watch the steps go green: tests, copy, install, restart, and finally the `curl` printing `{"message":"Hello World"}`.

The first run takes a few minutes, because GitHub downloads a test copy of MongoDB for `npm test`. Later runs are faster.

The API is now running on the droplet, but only the droplet itself can reach it. Try it from your computer, and it times out:

```bash
$ curl -m 5 http://YOUR-SERVER:5000/api/ping
curl: (28) Connection timed out after 5001 milliseconds
```

That's the firewall doing its job. Next, you'll give the outside world a proper way in.

## 9. Put Apache in front of the API

### What a reverse proxy is

A **reverse proxy** is a web server that stands in front of your app. Browsers talk only to the proxy; the proxy passes each request on to the app and hands the app's answer back. The browser never knows the app exists.

```text
 browser ──► GET http://YOUR-HOSTNAME/api/ping
               │
               ▼
 Apache (port 80, open to the world)
   "the path starts with /api, so forward it"
               │
               ▼
 GET http://127.0.0.1:5000/api/ping   ──►  Node API (port 5000, droplet-only)
               │
               ▼
 {"message":"Hello World"}  ──►  Apache  ──►  browser
```

Putting Apache in front of Node buys you several things at once:

- **One public address.** Users visit `https://YOUR-HOSTNAME`; nobody needs to know about port 5000, and the firewall keeps it closed.
- **HTTPS in one place.** Apache handles the encryption (part 10). The API keeps speaking plain HTTP to Apache *inside* the droplet, where nobody can listen in.
- **One site for frontend and API.** In Step 13, Apache will also serve the React app from the same address. Because the page and the API share an address, the browser needs no special cross-origin (CORS) permission, and the frontend can simply ask for `/api/...`.
- **A sturdy front door.** Apache is battle-tested at handling slow, broken, or malicious connections before they reach your code.

A *forward* proxy, by contrast, works on behalf of *clients* (like a school network's web filter). A *reverse* proxy works on behalf of a *server*.

### The site configuration

Open `deploy/apache-cards.conf`. The parts that matter now:

```apache
<VirtualHost *:80>
    ServerName YOUR-HOSTNAME

    ProxyPass        /api http://127.0.0.1:5000/api
    ProxyPassReverse /api http://127.0.0.1:5000/api
    ProxyPreserveHost On

    DocumentRoot /var/www/cards
    ...
</VirtualHost>
```

- **`<VirtualHost *:80>`** defines one *site* on port 80. Apache can host many sites on one server.
- **`ServerName`** is how Apache tells sites apart: a request is for whichever site's name matches the hostname the browser asked for. Requests for anything else, including the bare IP address, go to the droplet's default site, so an earlier LAMP project there keeps working.
- **`ProxyPass /api http://127.0.0.1:5000/api`** is the reverse proxy: any request whose path starts with `/api` is forwarded to the API. `127.0.0.1` means "this same machine."
- **`ProxyPassReverse`** fixes the other direction: if the API ever answers with a redirect pointing at `http://127.0.0.1:5000/...`, Apache rewrites it to point back at your site.
- **`ProxyPreserveHost On`** passes the browser's original hostname along to Express instead of `127.0.0.1`.
- **`DocumentRoot`** and the `<Directory>` blocks serve the frontend's files from `/var/www/cards`. You'll look at those in Step 13; for now they serve the placeholder page.

### Install it

Copy the file to the droplet as `root`:

```bash
$ scp deploy/apache-cards.conf root@YOUR-SERVER:/etc/apache2/sites-available/cards.conf
$ ssh root@YOUR-SERVER
```

Then, **on the droplet as root**, put your hostname into it and turn it on:

```bash
$ sed -i 's/YOUR-HOSTNAME/cards-jsmith.duckdns.org/' /etc/apache2/sites-available/cards.conf
$ a2enmod proxy proxy_http
$ a2ensite cards
$ apachectl configtest
Syntax OK
$ systemctl reload apache2
$ exit
```

Use **your** hostname in the `sed` line, not `cards-jsmith.duckdns.org`.

- **`a2enmod proxy proxy_http`** turns on Apache's proxy modules (they're installed but off by default).
- **`a2ensite cards`** enables the site (it links the file into `/etc/apache2/sites-enabled`).
- **`apachectl configtest`** checks the configuration before you apply it. If it reports an error, fix it before reloading; a broken configuration can take down every site on the server. (A notice that starts with `AH00558: Could not reliably determine the server's fully qualified domain name` is harmless.)
- **`systemctl reload apache2`** applies the change without dropping open connections.

Now, from **your computer**:

```bash
$ curl http://YOUR-HOSTNAME/api/ping
{"message":"Hello World"}
$ curl http://YOUR-HOSTNAME/
<p>The Cards frontend arrives in Step 13.</p>
```

The API is reachable through Apache, while port 5000 is still closed.

## 10. Turn on HTTPS

Right now, everything travels as plain text: anyone on the same Wi-Fi network as a user could read their password as they log in, or copy their login token. **HTTPS** encrypts the connection. It needs a **certificate** proving that the server really owns `YOUR-HOSTNAME`; **Let's Encrypt** issues them for free, and **Certbot** (usually already installed on the LAMP image) gets one and configures Apache for you.

On the droplet, as `root`:

```bash
$ ssh root@YOUR-SERVER
$ certbot --apache -d YOUR-HOSTNAME --redirect --agree-tos -m YOUR-EMAIL --no-eff-email
...
Successfully deployed certificate for YOUR-HOSTNAME to /etc/apache2/sites-available/cards-le-ssl.conf
Congratulations! You have successfully enabled HTTPS on https://YOUR-HOSTNAME
$ exit
```

Use your hostname and your email address (Let's Encrypt emails you only if something needs your attention). What Certbot just did:

1. **Proved you control the hostname.** Let's Encrypt asked for a secret file at `http://YOUR-HOSTNAME/.well-known/acme-challenge/...`, and Certbot made Apache serve it. That's why the hostname had to point at your droplet first.
2. **Created an HTTPS site**, `cards-le-ssl.conf`: a copy of your site on port 443 with the certificate added. Your reverse proxy rules came along, so `/api` works over HTTPS too.
3. **Redirected HTTP to HTTPS** (`--redirect`): anyone visiting `http://` is sent to `https://`.
4. **Set up automatic renewal.** Certificates last 90 days, and a timer renews them in the background long before then.

From your computer:

```bash
$ curl https://YOUR-HOSTNAME/api/ping
{"message":"Hello World"}
$ curl -I http://YOUR-HOSTNAME/api/ping
HTTP/1.1 301 Moved Permanently
Location: https://YOUR-HOSTNAME/api/ping
```

Open `https://YOUR-HOSTNAME/api/docs` in your browser and look for the padlock in the address bar.

Because the frontend in Step 13 will be served by this same site, it gets HTTPS automatically: the certificate covers the whole hostname, not just `/api`.

## 11. Load the test data into Atlas

Your Atlas database is empty: `mongo-init.js` only runs in your laptop's Docker setup. The Bruno collection doesn't need any existing data, because it registers its own test user each time it runs. But from Step 13 on, you'll want to log in to the live site as `johnaedo` and see a collection of cards.

The deploy copied `seed.js`, which creates the `johnaedo` user and 20 cards, to the droplet. Run it there, so it uses the droplet's `.env` and the IP address you allowed in Atlas:

```bash
$ ssh deploy@YOUR-SERVER
$ cd /opt/cards-api
$ npm run seed
Connected to MongoDB server via Mongoose
Seeded initial user: johnaedo
Seeded 20 Looney Tunes cards for user johnaedo.
$ exit
```

(When you log in yourself, nvm loads normally, so plain `npm` works.) It's safe to run again; it skips anything that already exists.

## 12. Run the Bruno collection against production

Open `cards-backend/api-tests/environments/Production.yml` and set the address to your site. There's no port number any more: Apache answers on the standard HTTPS port.

```yaml
  - name: baseURL
    value: https://YOUR-HOSTNAME
```

In Bruno, switch the environment to **Production** and run the collection. All 23 tests should pass, as they do locally.

Each run's **Register** request creates a new user named `student` followed by a number, and that user stays in your Atlas database. That's harmless, but if they pile up you can delete them in Compass or in Atlas's *Data Explorer* (the `users` collection).

Commit the address:

```bash
$ git add api-tests/environments/Production.yml
$ git commit -m "Step 7: production address"
$ git push
```

That push deploys again. Check the Actions tab: from now on, **every push to GitHub is a deploy**.

## 13. Looking after the server

You'll rarely need to log in, but when you do, use `ssh deploy@YOUR-SERVER`:

| Command | Shows |
|---|---|
| `systemctl --user status cards-api` | whether the API is running, and its last few log lines |
| `journalctl --user-unit cards-api -f` | the API's log, live (`Ctrl+C` to stop). Your `console.log` output appears here. |
| `systemctl --user restart cards-api` | restarts it (after editing `.env`, for example) |

None of these need `sudo`. Use `root` only for administrator jobs, like installing packages or changing the Apache configuration. As root, Apache's log for your site is `/var/log/apache2/cards-error.log`, and `certbot renew --dry-run` checks that certificate renewal will work.

**Upgrading Node later:** log in as `deploy` and run `nvm install 27 && nvm alias default 27`. Then change `26` to `27` in three places: `NODE_VERSION` in `deploy/cards-api.service` (copy it to `~/.config/systemd/user/` on the droplet again and run `systemctl --user daemon-reload`), and both the `node-version` and `NODE_VERSION=26` lines in `deploy.yml`.

---

## Check your work

- [ ] `ssh deploy@YOUR-SERVER` logs in without a password, and `node --version` there shows v26
- [ ] The Actions tab shows a green run with every step passed, including the final `curl`, and `.github/workflows/deploy.yml` contains no `sudo`
- [ ] Reboot the droplet (as root: `reboot`), wait a minute, and `curl https://YOUR-HOSTNAME/api/ping` works again without you logging in
- [ ] `curl https://YOUR-HOSTNAME/api/ping` works from your own computer, and the browser shows a padlock at `https://YOUR-HOSTNAME/api/docs`
- [ ] `http://YOUR-HOSTNAME/...` redirects to `https://`
- [ ] Port 5000 is **closed** to the outside: `curl -m 5 http://YOUR-SERVER:5000/api/ping` times out
- [ ] The Bruno collection passes **23/23** with the **Production** environment
- [ ] As `deploy`, `systemctl --user status cards-api` says **active (running)**, and `ps -o user= -C node-MainThread` shows `deploy`, not `root`
- [ ] Break a test on purpose and push: the workflow fails at **Run the tests**, and the server keeps running the previous version. Then fix it and push again.

## A note on this setup

Apache, MySQL, and PHP from the LAMP image keep running; your Cards site is one more Apache site alongside whatever was there before. A production-grade setup would also turn off SSH logins as `root` once setup is finished, back up the database, and would not seed a test account whose password is published in a tutorial. Keep that last point in mind: anyone who reads this can log in as `johnaedo` on your server.

## Troubleshooting

Start with the API's log, which shows why it stopped. As `deploy`: `journalctl --user-unit cards-api -n 50`. For Apache problems, as root: `tail /var/log/apache2/cards-error.log`.

**The droplet and the deploy**

- **`ssh deploy@YOUR-SERVER` asks for a password** — your key wasn't copied to the new user. As root, rerun `rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy`.
- **`journalctl` says *No journal files were found*, or shows nothing** — `deploy` isn't in the `systemd-journal` group yet. As root: `usermod -aG systemd-journal deploy`, then log out and back in.
- **Actions: `Permission denied (publickey)`** — `SSH_PRIVATE_KEY` must be the *private* key (no `.pub`), pasted in full, and its `.pub` half must be in `deploy`'s keys (part 7's `ssh-copy-id deploy@...`). Also check `SSH_USER` is `deploy`.
- **Actions: `Host key verification failed`** — `SSH_HOST` is wrong or empty. It should be just the IP address.
- **Actions: `rsync: command not found`** — install rsync on the droplet (part 3).
- **Actions: `rsync: ... Permission denied`** — `/opt/cards-api` isn't owned by `deploy`. As root: `chown deploy:deploy /opt/cards-api`.
- **Actions: `nvm-exec: No such file or directory`** — nvm isn't installed for `deploy` (part 4). It must be installed while logged in as `deploy`, not as root.
- **Actions: `nvm-exec` fails with `... is not yet installed`** — log in as `deploy` and run `nvm install 26`.
- **Actions or `systemctl --user`: `Failed to connect to bus: No medium found`** (or `$DBUS_SESSION_BUS_ADDRESS and $XDG_RUNTIME_DIR not defined`) — `deploy`'s service manager isn't running. As root, run `loginctl enable-linger deploy` (part 3). In your own SSH session, also check you aren't using `su` or `sudo -u deploy` to become `deploy`; log in directly with `ssh deploy@YOUR-SERVER`.
- **Actions: `Failed to restart cards-api.service: Unit cards-api.service not found`** — part 5 wasn't done. As `deploy`, check `ls ~/.config/systemd/user/cards-api.service`, then run `systemctl --user daemon-reload`.
- **The API stops when you log out, or doesn't come back after a reboot** — lingering is off (`ls /var/lib/systemd/linger` doesn't list `deploy`), or the service isn't enabled. As root: `loginctl enable-linger deploy`; as `deploy`: `systemctl --user enable cards-api`.
- **Followed an earlier version of this step, with a service in `/etc/systemd/system` and a sudo rule?** Remove them, or the old service will hold port 5000 and the new one will crash with `EADDRINUSE`. As root: `systemctl disable --now cards-api && rm /etc/systemd/system/cards-api.service /etc/sudoers.d/cards-api && systemctl daemon-reload`. Then do parts 3 (lingering) and 5 again.
- **Actions: the `curl` step fails with `Couldn't connect to server`** — the API started and then crashed. Check the log. The usual causes are below.
- **The Actions run says *Deploy skipped*** — the repository secrets aren't set (part 7).

**The API**

- **Log: `JWT_SECRET is not set`** — `/opt/cards-api/.env` is missing, or isn't readable by `deploy`. As `deploy`, check `ls -l /opt/cards-api/.env` shows `deploy deploy`.
- **Log: `MongoDB connection error` with `querySrv`, `ETIMEOUT`, or `Server selection timed out`** — Atlas is refusing the droplet. Add the droplet's IP address under *Network Access* in Atlas.
- **Log: `bad auth : authentication failed`** — the user or password in `MONGODB_URI` is wrong. If the password has special characters, change it in Atlas to letters and numbers only, and update `.env`.
- **Compass can't connect to Atlas** — your laptop's current public IP isn't on the Atlas *Network Access* list. Check [whatismyip.com](https://www.whatismyip.com) and add or update it.
- **Logging in as `johnaedo` on the live site fails** — the seed hasn't run against Atlas yet (part 11). (The Bruno collection doesn't use `johnaedo`, so it passes either way.)

**Apache, the hostname, and HTTPS**

- **`nslookup YOUR-HOSTNAME` doesn't show your droplet's IP** — on DuckDNS, check the **current ip** box and click **update ip**. Changes can take a minute or two.
- **`http://YOUR-HOSTNAME/` shows the droplet's old default page instead of the placeholder** — Apache didn't match your site. Check the `ServerName` line in `/etc/apache2/sites-available/cards.conf` is exactly your hostname, and that `a2ensite cards` and the reload were done.
- **`/api/...` returns `503 Service Unavailable`** — Apache is fine, but the API isn't running. As `deploy`, check `systemctl --user status cards-api` and the API's log.
- **`/api/...` returns an Apache `404 Not Found` page** — the proxy rules aren't active. Run `a2enmod proxy proxy_http`, check the `ProxyPass` lines, then `apachectl configtest` and reload.
- **`apachectl configtest` says `Invalid command 'ProxyPass'`** — the proxy modules are off: `a2enmod proxy proxy_http`.
- **Certbot: `DNS problem: NXDOMAIN` or `Timeout during connect`** — Let's Encrypt couldn't reach your droplet by its hostname. Check `nslookup`, and that `http://YOUR-HOSTNAME/` works from your computer first.
- **Certbot: `Unable to find a virtual host listening on port 80`** or **`Could not automatically find a matching server block`** — the hostname in the `certbot -d` command doesn't match the site's `ServerName`. Make them identical.
- **Certbot: `The requested apache plugin does not appear to be installed`** — as root: `apt-get install -y certbot python3-certbot-apache`.
- **Certbot: `too many certificates already issued`** — Let's Encrypt limits how often the same name can get a new certificate. You only need one; if you're stuck, wait a few days or use a different DuckDNS name.
- **Earlier, you opened port 5000 in the firewall** (from an older version of this tutorial) — close it: as root, `ufw delete allow 5000/tcp`.

**Next:** [Step 8 — Create the React app](../08-react-app/README.md)
