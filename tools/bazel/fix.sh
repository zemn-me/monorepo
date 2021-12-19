cd $INIT_CWD
FIX_BAZEL --lint=fix
FIX_GO -s -w .
FIX_JS --fix --ignore-path .gitignore '**/*.ts' '**/*.js' '**/*.tsx' '**/*.json'