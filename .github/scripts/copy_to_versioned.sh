#!/usr/bin/env bash

git push

echo "Open PR to versioned branch (or not, if it was already there)"
echo ""
echo "Skipping failure here too, becuase we don't actually care"
echo "if the PR is already there."
gh pr create -f --base versioned || git push -f

echo "Setting PR to merge automatically..."
gh pr merge --auto --merge
