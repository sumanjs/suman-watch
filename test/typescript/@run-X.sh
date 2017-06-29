#!/usr/bin/env bash

cd $(dirname "$0");
echo "we are running @run.sh"
chmod -R 777 $(pwd)/@target

if [[ ! -z ${SUMAN_CHILD_TEST_PATH} ]]; then

    SUMAN_TARGET="${SUMAN_CHILD_TEST_PATH//@src/@target}"
    SUMAN_RUNNABLE=${SUMAN_TARGET%.*}.js
    echo "SUMAN_RUNNABLE => ${SUMAN_RUNNABLE}"
    echo "node version => $(node -v)"
    node ${SUMAN_RUNNABLE} | tee -a run.log

else

   suman --test-paths-json="${SUMAN_TEST_PATHS}" --replace-match="/@src/" --replace-with="/@target/" --replace-ext-with=".js"

fi

EXIT_CODE=$?;
echo "EXIT_CODE => $EXIT_CODE"
exit ${EXIT_CODE};

