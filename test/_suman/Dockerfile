# start with this image as a base
FROM node:7

#RUN npm cache clean

#RUN apt-get update && \
#      apt-get -y install sudo

RUN chmod -R 777 $(npm root -g)
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json .
RUN npm install
RUN npm install github:sumanjs/suman#rebase_branch

COPY . .

RUN (cd node_modules && ls -a)

RUN (cd node_modules/suman && ls -a)

#CMD ["node","/usr/src/app/node_modules/suman/cli.js"]

ENTRYPOINT ["/usr/src/app/node_modules/suman/cli.js"]