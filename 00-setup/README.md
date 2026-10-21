# Step 0 — Set Up Your Tools

**You'll end with:** every tool the course uses, installed and working, and a workspace folder ready for Step 1.
**Time:** 30–60 minutes, mostly downloads.

---

## What you'll install

| Tool                             | What it's for                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Node.js 26** (LTS)             | Runs JavaScript outside the browser. Your API runs on it, and so do the frontend's build tools.              |
| **Git**                          | Tracks every change to your code and pushes it to GitHub.                                                    |
| **Docker** (with Docker Compose) | Runs your API and MongoDB in containers, so they behave the same on every computer, including your server.   |
| **VS Code**                      | Your code editor.                                                                                            |
| **Bruno**                        | Sends requests to your API and runs tests against it, so you can try the backend before any frontend exists. |
| A **GitHub** account             | Stores your repositories; later it deploys your frontend for you.                                            |

## 1. Windows only: install WSL

On Windows, do everything in **WSL** (Windows Subsystem for Linux), a real Ubuntu terminal inside Windows. Docker Desktop uses it too.

Open **PowerShell as Administrator** and run:

```powershell
wsl --install
```

Restart when asked, then open **Ubuntu** from the Start menu and create a Linux username and password. From now on, **every command in these tutorials runs in that Ubuntu terminal**, not in PowerShell. Install Node and Git *inside* Ubuntu using the Linux instructions below.

> Keep your projects inside the Linux file system (for example `~/mern-cards`), not under `/mnt/c/...`. File watching and installs are much faster there.

## 2. Install Node.js 26

The easiest way, on every system, is **nvm** (Node Version Manager), which also lets you switch versions later:

```bash
$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Close and reopen your terminal, then:

```bash
$ nvm install 26
$ nvm use 26
$ node --version
v26.x.x
$ npm --version
12.x.x
```

Any `v22` (or a newer even-numbered LTS release) is fine.

## 3. Install Git

- **macOS:** run `git --version`; if Git isn't installed, macOS offers to install it.
- **Linux / WSL:** `sudo apt update && sudo apt install -y git`

Then tell Git who you are (use the email on your GitHub account):

```bash
$ git config --global user.name "Your Name"
$ git config --global user.email "you@example.com"
$ git config --global init.defaultBranch main
```

## 4. Install Docker

- **Windows and macOS:** install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it. On Windows, in Docker Desktop's **Settings → Resources → WSL integration**, turn it on for Ubuntu.
- **Linux:** follow [Install Docker Engine](https://docs.docker.com/engine/install/) for your distribution, which includes the Compose plugin. Then let your user run Docker without `sudo`: `sudo usermod -aG docker $USER`, and log out and back in.

Check it:

```bash
$ docker --version
$ docker compose version
$ docker run --rm hello-world
```

The last command should print *"Hello from Docker!"*.

## 5. Install VS Code and Bruno

- [VS Code](https://code.visualstudio.com/). On Windows, also install the **WSL** extension, then open projects from the Ubuntu terminal with `code .`.
- [Bruno](https://www.usebruno.com/downloads), the API client. Install it on your normal desktop (on Windows, the Windows version is fine: it can reach `localhost` inside WSL).

## 6. Create a GitHub account and SSH key

If you don't have one, sign up at [github.com](https://github.com). Then create an SSH key so you can push without typing a password:

```bash
$ ssh-keygen -t ed25519 -C "you@example.com"     # press Enter to accept the defaults
$ cat ~/.ssh/id_ed25519.pub
```

Copy the line it prints, and on GitHub go to **Settings → SSH and GPG keys → New SSH key** and paste it. Test it:

```bash
$ ssh -T git@github.com
Hi your-username! You've successfully authenticated...
```

## 7. Create your workspace

Make one folder that will hold both projects:

```bash
$ mkdir -p ~/mern-cards
```

Now set two shell variables the tutorials use for copying files. `TUTORIALS` is wherever this `tutorials` folder lives on your computer; adjust the path to match:

```bash
$ echo 'export WORKSPACE=~/mern-cards' >> ~/.bashrc
$ echo 'export TUTORIALS=~/path/to/tutorials' >> ~/.bashrc     # ← change this path
$ source ~/.bashrc
$ ls "$TUTORIALS"
00-setup  01-hello-express  02-mongodb  ...
```

(On macOS with the default zsh shell, use `~/.zshrc` instead of `~/.bashrc`.)

---

## Check your work

Run each command; all should succeed:

```bash
$ node --version            # v26 or newer
$ git --version
$ docker compose version
$ docker run --rm hello-world
$ ssh -T git@github.com     # "Hi your-username!"
$ ls "$TUTORIALS/01-hello-express"
checkpoint  files  README.md
```

And open Bruno once to make sure it starts.

## Troubleshooting

- **`docker: permission denied` on Linux** — you skipped `usermod -aG docker $USER`, or you haven't logged out and back in since.
- **`Cannot connect to the Docker daemon`** — Docker Desktop isn't running. Start it and wait until it says it's running.
- **`nvm: command not found`** — close and reopen the terminal after installing nvm.
- **`$TUTORIALS` is empty** — run `source ~/.bashrc`, or open a new terminal.

**Next:** [Step 1 — Hello Express](../01-hello-express/README.md)
