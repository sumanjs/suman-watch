# start with this image as a base
FROM node:7

#RUN npm cache clean

RUN apt-get update && \
      apt-get -y install sudo

RUN sudo apt-get install -y sqlite3 libsqlite3-dev

RUN chmod -R 777 $(npm root -g)
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN npm config --global set color false
RUN npm --global set progress=false

COPY package.json .
RUN npm install
RUN npm install github:sumanjs/suman#rebase_branch

COPY . .

#CMD ["node","/usr/src/app/node_modules/suman/cli.js"]

ENTRYPOINT ["/usr/src/app/node_modules/suman/cli.js"]