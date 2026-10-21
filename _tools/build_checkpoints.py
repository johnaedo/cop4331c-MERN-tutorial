"""Rebuilds every tutorial step's checkpoint/ folder.

Each step folder (01-..., 02-..., ...) may have a files/ folder holding only
the files that step adds or changes. A step's checkpoint/ is the complete
project at the end of that step: the previous checkpoint with this step's
files/ copied on top.

After editing anything in a files/ folder, run (from the repository root):

    python tutorials/_tools/build_checkpoints.py

To check that the last checkpoint matches the finished apps, pass the paths
of the backend and frontend repositories:

    python tutorials/_tools/build_checkpoints.py --compare . ../cop4331c-mern-frontend
"""
import argparse
import filecmp
import shutil
import subprocess
from pathlib import Path

TUTORIALS = Path(__file__).resolve().parent.parent
PROJECTS = {"cards-backend", "cards-frontend"}

# Files that differ on purpose between the last checkpoint and the reference
# repos: students point these at their own server.
EXPECTED_DIFFERENCES = {
    "cards-backend/api-tests/environments/Production.yml",
    "cards-frontend/.env.production",
}

# Files in the reference repos that are not part of the student project
NOT_IN_PROJECT = {"README.md", "Tutorial.md", "package-lock.json"}


def step_dirs():
    return sorted(p for p in TUTORIALS.iterdir() if p.is_dir() and p.name[:2].isdigit())


def build():
    previous = None
    for step in step_dirs():
        files = step / "files"
        checkpoint = step / "checkpoint"
        if previous is None and not files.exists():
            continue  # steps before the first code (setup)
        if checkpoint.exists():
            shutil.rmtree(checkpoint)
        if previous is not None:
            shutil.copytree(previous, checkpoint)
        if files.exists():
            shutil.copytree(files, checkpoint, dirs_exist_ok=True)
        print(f"built {checkpoint.relative_to(TUTORIALS)}")
        previous = checkpoint
    return previous


def tracked_files(repo):
    out = subprocess.run(["git", "ls-files"], cwd=repo, capture_output=True, text=True, check=True)
    return {
        line for line in out.stdout.splitlines()
        if line and not line.startswith("tutorials/") and line not in NOT_IN_PROJECT
    }


def compare(last_checkpoint, backend, frontend):
    problems = 0
    for name, repo in (("cards-backend", backend), ("cards-frontend", frontend)):
        repo = Path(repo).resolve()
        project = last_checkpoint / name
        expected = tracked_files(repo)
        actual = {str(p.relative_to(project)) for p in project.rglob("*") if p.is_file()}
        for rel in sorted(expected - actual):
            print(f"MISSING from checkpoint: {name}/{rel}")
            problems += 1
        for rel in sorted(actual - expected):
            print(f"EXTRA in checkpoint:     {name}/{rel}")
            problems += 1
        for rel in sorted(expected & actual):
            key = f"{name}/{rel}"
            if not filecmp.cmp(repo / rel, project / rel, shallow=False) and key not in EXPECTED_DIFFERENCES:
                print(f"DIFFERENT:               {key}")
                problems += 1
    print("Last checkpoint matches the reference repos." if problems == 0 else f"{problems} problem(s)")
    return problems


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--compare", nargs=2, metavar=("BACKEND_REPO", "FRONTEND_REPO"))
    args = parser.parse_args()
    last = build()
    if args.compare:
        raise SystemExit(1 if compare(last, *args.compare) else 0)
