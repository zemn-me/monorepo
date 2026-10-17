#!/usr/bin/env bash
set -euo pipefail
scratch="${TEST_TMPDIR:?}"
printf '#include <stdio.h>\nint main(void) { puts("compiler works"); }\n' > "$scratch/main.c"
cc "$scratch/main.c" -o "$scratch/main"
test "$("$scratch/main")" = 'compiler works'
printf '#include <iostream>\nint main() { std::cout << "c++ works"; }\n' > "$scratch/main.cc"
c++ "$scratch/main.cc" -o "$scratch/main-cxx"
test "$("$scratch/main-cxx")" = 'c++ works'
make --version
perl -e 'print "perl works\n"'
python3 -c 'import sys; assert sys.version_info.major == 3'
git --version
patch --version
