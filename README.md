# trc.cli
Command line interface for TRC

'xxx' is the secret canvas code for accessing a sheet.   
This is a command line wrapper that calls the TRC REST apis via https://github.com/Voter-Science/TrcLibNpm

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
