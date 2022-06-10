#!/usr/bin/env bash

echo "Open PR to versioned branch (or not, if it was already there)"
echo ""
echo "Skipping failure here too, becuase we don't actually care"
echo "if the PR is already there."
gh pr create -f --head main --base versioned || true

echo "This ensures we have our commits pushed. We could be up to date"
echo "already. But it doesn't really matter."
git push || true

echo "Setting PR to merge automatically..."
gh pr merge versioned --auto --merge
