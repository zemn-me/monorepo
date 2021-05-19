yarn upgrade -L $1
git add -A
git commit -m "upgrade $1" || git reset --hard