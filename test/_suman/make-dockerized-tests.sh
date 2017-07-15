#!/usr/bin/env bash

# docker run -it your-dockerized-suman-tests-image /bin/bash

cd $(dirname "$0");
npm_root="$(npm root)";
project_root="$(cd ${npm_root} && cd .. && pwd)";

project_basename="$(basename ${project_root})";

image_tag="your-dockerized-suman-tests-image";
container_name="your-dockerized-suman-tests"

dockerfile_root="${project_root}/$(uuidgen)"

cp Dockerfile ${dockerfile_root}

#
#docker rmi -f $(docker images --no-trunc | grep "<none>" | awk "{print \$3}")
#docker rmi -f $(docker images --no-trunc | grep "${image_tag}" | awk "{print \$3}")
#docker rmi -f ${image_tag}
#

docker stop ${container_name} || echo "no container needed to be stopped";
docker rm ${container_name} ||  echo "no container needed to be removed";

#cp ${project_root} symlinked-project
docker build -t ${image_tag} -f ${dockerfile_root} ${project_root} # > /dev/null

rm -rf ${dockerfile_root};
echo "removed temporary Dockerfile with id ${dockerfile_root}"
docker run -v "${project_root}/node_modules":/usr/src/app --name  ${container_name} ${image_tag}

