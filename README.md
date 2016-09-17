# trc.cli
Command line interface for TRC.
This is a command line wrapper that calls the TRC REST apis via https://github.com/Voter-Science/TrcLibNpm

## Quick install
You can install trc.cli by cloning this repo, doing an `npm install` to pull down depedencies, `npm run build` to build it, and then go. 

trc.cli is published to NPM. You can download it via `npm install` and then immediately run it with node. 

```
npm install trc.cli
node node_modules\trc.cli ...arguments...
```

To access TRC, you'll need to pass your secret 'canvass code' for login. This is the same login that is used on the webpage and mobile apps.  

In the examples below, 'xxx' is the secret canvas code for accessing a sheet.   


## Get info 
Prints basic information about a sheet to the console.
```
node index.js xxxxx info
```

## Get latest sheet contents
Downloads the latest sheet contents to a CSV file. 
```
node index.js xxxxx getall %filename%
node index.js xxxxx getall contents.csv
```

## Get full history 
Downloads the full change history for this sheet to a csv file. This just includes the specific submits that users made and not the actual sheet contents. 

```
node index.js xxxxx history %filename%
node index.js xxxxx history hist.csv
```
