
import * as trc from './node_modules/trclib/trc2';

declare var process: any;  // https://nodejs.org/docs/latest/api/process.html
declare var require: any;
var fs = require('fs');

function failureFunc(error: trc.ITrcError): void {
    console.log("*** failed with " + error.Message);
}


function toCsv(data: trc.ISheetContents): string {
    let colKeys: string[] = Object.keys(data);
    let grid: string[][] = [];
    let rowCount = data[colKeys[0]].length;
    let index = 0;

    grid.push(colKeys);

    while (index < rowCount) {
        let row: string[] = [];
        for (let colKey of colKeys) {
            row.push(data[colKey][index]);
        }
        grid.push(row);
        index++;
    }

    let content = "";

    grid.forEach((arr, index) => {
        let row = arr.join(",");
        content += index < grid.length ? row + "\r\n" : row;
    });
    return content;
}

// Download the contents to a file
function getContents(sheet: trc.Sheet, filename: string): void {
    console.log("Downloading contents to file: " + filename);
    sheet.getInfo(info => {
        console.log("Sheet has " + info.CountRecords + " rows.")
        sheet.getSheetContents(contents => {
            var str = toCsv(contents);
            fs.writeFile(filename, str);
        });
    });
}

// Download the change log
function getFullHistory(sheet: trc.Sheet, filename: string): void {
    console.log("Downloading change log to file: " + filename);
    sheet.getInfo(info => {
        console.log("Sheet has " + info.LatestVersion + " changes.")

        var cVersion : string[] = [];
        var cUser : string[] = [];
        var cLat :  string[] = [];
        var cLong :  string[] = [];
        var cTimestamp :  string[] = [];
        var cUserIp :  string[] = [];
        var cApp:  string[] = [];
        var cValue :  string[] = [];
        var contents : trc.ISheetContents = { };
        contents["Version"] = cVersion;
        contents["User"] = cUser;
        contents["Lat"] = cLat;
        contents["Long"] = cLong;
        contents["Timestamp"] = cTimestamp;
        contents["UserIp"] = cUserIp;
        contents["App"] = cApp;
        contents["Changes"] = cValue;


        sheet.getDeltas(segment => {
            for(var i = 0; i < segment.Results.length; i++)
            {
                var result : trc.IDeltaInfo = segment.Results[i];
                cVersion.push(result.Version.toString());
                cUser.push(result.User);
                cLat.push(result.GeoLat);
                cLong.push(result.GeoLong);
                cTimestamp.push(result.Timestamp);
                cUserIp.push(result.UserIp);
                cApp.push(result.App);
                cValue.push(JSON.stringify(result.Value));
            }

            var csv = toCsv(contents);
            fs.writeFile(filename, csv);
        });
    });
}


// Get information about the sheet
function info(sheet: trc.Sheet): void {
    sheet.getInfo(info => {
        console.log("Name:    " + info.Name);
        console.log("PName:   " + info.ParentName);
        console.log("SheetId: " + sheet.getId());
        console.log("ver:     " + info.LatestVersion);
        console.log("records: " + info.CountRecords);
    });
}

function usage()
{
    console.log("[code] [command] [args]");
    console.log();
    console.log("where [code] is the login code.");
    console.log("[command] can be:");
    console.log("   info   - quick, gets info about sheet ");
    console.log("   getall <filename> - slow, downloads latest contents to local file.");
}

function main() {
    console.log("TRC Command Line interface");

    if (process.argv.length < 4) {
        usage();
        return;
    }
    var code = process.argv[2];
    console.log(code);
    var cmd = process.argv[3];

    var loginUrl = "https://trc-login.voter-science.com";

    trc.LoginClient.LoginWithCode(loginUrl, code,
        (sheet: trc.Sheet) => {
            console.log("Login successful...");

            if (cmd == 'info') {
                info(sheet);
            }
            else if (cmd == 'getall') {
                var filename = process.argv[4];
                getContents(sheet, filename);
            }
            else if (cmd == 'history') {
                var filename = process.argv[4];
                getFullHistory(sheet, filename);
            } else {
                console.log("Unrecognized command: " + cmd);                
            }

        }, failureFunc);

}

main();
