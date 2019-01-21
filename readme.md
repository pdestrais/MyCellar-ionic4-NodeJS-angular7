# Notepad ionic 4 - NodeJS - Electron application
This notepad application is written in javascript using angular6/ionic4.
It uses a pouchDB to store notes to the local storage and can synchronize with a cloud Cloudant database to share notes between devices.

This application can be run either on a mobile (using PWA), in a browser or as a desktop application (using electron).

## installation
As always, type  `npm install`

## usage

### in development
the following command is used to start the dev server (from the project root/client)

      npm start

To test the application under electron, build the code using 

     npm run build

A 'www' directory will be created. This directory will be used for NodeJS as well as for electron.

To test with electron, launch electron from the project's 'client' directory :

     electron .

To test with NodeJS, go to root directory and start nodeJS with 

     npm start

### build prepare for the different deployment targets
First, build the application for the 'client' directory

     ionic build --prod or npm run buildProd

- prepare to build the desktop application using electron builder

        npm run dist

  A 'dist' directory will be created under the root of the project.
  A 'dmg' file has been created, double click on the file to install on the OS.

- prepare to release publish as a nodeJS app on the IBM cloud (you need to have a user id on IBM cloud).
Go to the root directory, then login to could foundry (if not yet done) and push the nodeJS as a cloudfoundry application :

       cf login
       cf push



**Remark**
The cloudant remote DB URL used for development is the following :

https://0f3af673-f18c-4bab-968f-7757df974f8d-bluemix:adbacaa3f35ab290ac2209110848aa4994a8d1680927ac2bb6d3fbe2251c5d6f@0f3af673-f18c-4bab-968f-7757df974f8d-bluemix.cloudant.com/notes