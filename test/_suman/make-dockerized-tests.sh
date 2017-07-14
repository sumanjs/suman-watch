#!/usr/bin/env bash

cd $(dirname "$0");
npm_root="$(npm root)";
project_root="$(cd ${npm_root} && cd .. && pwd)";

project_basename="$(basename ${project_root})";
expected_symlink="symlinked-project/$project_basename";

if [[ ! -L ${expected_symlink} ]]; then
    mkdir -p symlinked-project
    ln -s "${project_root}" ${expected_symlink}
fi

echo "$project_root"

symlinked_nm="$(pwd)/${expected_symlink}/node_modules"; # symlinked project's node_modules dir

echo "symlinked_nm => $symlinked_nm"

docker stop your-dockerized-suman-tests;
docker rm your-dockerized-suman-tests;

docker build -t your-dockerized-suman-tests-image .
docker run -v ${symlinked_nm}:/usr/src/app --name your-dockerized-suman-tests your-dockerized-suman-tests-image