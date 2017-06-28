#!/usr/bin/env bash

cd $(dirname "$0");

echo "pwd => $(pwd)"

WHICH_TSC=$(which tsc);

if [[ -z ${WHICH_TSC} ]]; then
  npm install -g typescript
fi


for x in $(suman-t --extract-json-array=${SUMAN_ALL_APPLICABLE_TEST_PATHS}); do
    tsc ${x} --outDir "$(dirname $(dirname ${x}))/@target" # transpile file with filepath ="x"
done

#tsc  # transpile file with filepath ="x"