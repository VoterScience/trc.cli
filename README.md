# trc.cli
Command line interface for TRC.
This is a command line wrapper that calls the TRC REST apis via https://github.com/Voter-Science/TrcLibNpm

## Quick install
You can install trc.cli by cloning this repo, doing an `npm install` to pull down depedencies, `npm run build` to build it, and then go. 

trc.cli is published to NPM. You can download it via `npm install` and then immediately run it with node. 

```
npm install --g trc.cli
trc ...arguments...
```

To access TRC, you'll need to pass your secret 'canvass code' for login. This is the same login that is used on the webpage and mobile apps.  

In the examples below, 'xxx' is the secret canvas code for accessing a sheet.   


## Get info 
Prints basic information about a sheet to the console. This is quick and prints basic version information. 
```
node index.js xxxxx info
```

## Get latest sheet contents
Downloads the latest sheet contents to a CSV file. This is the full contents
```
trc xxxxx getall %filename%
trc xxxxx getall contents.csv
```

## Get minimized sheet contents
Downloads the latest sheet contents to a CSV file. This just pulls the subset that was actually modified. 
```
trc xxxxx getmin %filename%
trc xxxxx getmin contents.csv
```

## Get full history 
Downloads the full change history for this sheet to a csv file. This just includes the specific submits that users made and not the actual sheet contents. 

```
trc xxxxx changelog  %filename%
trc xxxxx changelog history.json
```
