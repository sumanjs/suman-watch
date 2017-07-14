# start with this image as a base
FROM node:7

#RUN npm cache clean

#RUN apt-get update && \
#      apt-get -y install sudo


RUN chmod -R 777 $(npm root -g)

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY symlinked-project .

RUN chmod -R 777 .



# ENTRYPOINT ["/usr/src/app/test.sh"]