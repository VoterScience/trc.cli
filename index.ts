#! /usr/bin/env node

// See details for making a command line tool 
// http://blog.npmjs.org/post/118810260230/building-a-simple-command-line-tool-with-npm 

// Tips for type-resolution errors with bluebird. 
// https://stackoverflow.com/questions/37028649/error-ts2307-cannot-find-module-bluebird

import * as trc from 'trclib/trc2';
import { SheetContentsIndex, SheetContents, ISheetContents } from 'trclib/sheetcontents'

declare var process: any;  // https://nodejs.org/docs/latest/api/process.html
declare var require: any;
var fs = require('fs');

function failureFunc(error: trc.ITrcError): void {
    console.log("*** failed with " + error.Message);
}

// Download the contents to a file
function getContents(sheet: trc.Sheet, filename: string): void {
    console.log("Downloading contents to file: " + filename);
    sheet.getInfo(info => {
        console.log("Sheet has " + info.CountRecords + " rows.")
        sheet.getSheetContents(contents => {
            var str = SheetContents.toCsv(contents);
            fs.writeFile(filename, str);
        });

        // Show info about user 

    });
}

// Download the change log
// this is a high-fidelity capture of all the individual changes. 
function getFullChangeLog(sheet: trc.Sheet, filename: string): void {
    console.log("Downloading full change log to file: " + filename);
    sheet.getInfo(info => {
        console.log("Sheet has " + info.LatestVersion + " changes.")

        sheet.getDeltas(segment => {
            var x = JSON.stringify(segment.Results);
            fs.writeFile(filename, x);
        });
    });
}

// Create a new share code for this sheet 
function copyShareCode(sheet: trc.Sheet, newEmail: string): void {
    console.log("Creating new share code for:" + newEmail);
    var requireFacebook = true;
    sheet.createShareCode(newEmail, requireFacebook, (newCode) => {
        console.log("New code is:  " + newCode);
    });
}

// Each change can actually be an arbitrary rectangle size, although they're commonly a 1x1.
// So flatten it so that it can be viewed in a CSV.
// This means a we'll get multiple rows with the same version number.
function getFlattenedChangeLog(sheet: trc.Sheet, filename: string): void {
    console.log("Downloading change log to file: " + filename);
    sheet.getInfo(info => {
        console.log("Sheet has " + info.LatestVersion + " changes.")

        var counter = 0;
        var cVersion: string[] = [];
        var cUser: string[] = [];
        var cLat: string[] = [];
        var cLong: string[] = [];
        var cTimestamp: string[] = [];
        var cUserIp: string[] = [];
        var cApp: string[] = [];
        var cChangeRecId: string[] = [];
        var cChangeColumn: string[] = [];
        var cChangeValue: string[] = [];

        var contents: ISheetContents = {};
        contents["Version"] = cVersion;
        contents["User"] = cUser;
        contents["Lat"] = cLat;
        contents["Long"] = cLong;
        contents["Timestamp"] = cTimestamp;
        contents["UserIp"] = cUserIp;
        contents["App"] = cApp;
        contents["RecId"] = cChangeRecId;
        contents["ChangeColumn"] = cChangeColumn;
        contents["NewValue"] = cChangeValue;


        var worker = (de: trc.DeltaEnumerator) => {   
            console.log("Fetch");         
            var results = de.Results;
            if (results != null) {
                console.log("  got  " + results.length);
                for (var i = 0; i < results.length; i++) {
                    var result: trc.IDeltaInfo = results[i];

                    try {

                        // Flatten the result.Change. 
                        SheetContents.ForEach(result.Value, (recId, columnName, newValue) => {
                            cVersion.push(result.Version.toString());
                            cUser.push(result.User);
                            cLat.push(result.GeoLat);
                            cLong.push(result.GeoLong);
                            cTimestamp.push(result.Timestamp);
                            cUserIp.push(result.UserIp);
                            cApp.push(result.App);

                            cChangeRecId.push(recId);
                            cChangeColumn.push(columnName);
                            cChangeValue.push(newValue);
                        });
                    }
                    catch (error) {
                        // Malformed input. Ignore and keep going 
                    }
                }
            }

            if (de.NextLink != null) {
                console.log("Move next: " + de.NextLink);
                // Move to next segment 
                de.GetNext(de2 => worker(de2));
            } else {
                // Done 
                console.log("Done: " + cChangeRecId.length);
                var csv = SheetContents.toCsv(contents);
                fs.writeFile(filename, csv);
            }
        };

        sheet.getDeltasAsync(-1).then(de => worker(de));
        });
}

function refresh(sheet: trc.Sheet) {
    console.log("Send refresh notificaiton. This can take several minutes. ");
    sheet.postOpRefresh();
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

function usage() {
    console.log("[code] [command] [args]");
    console.log();
    console.log("where [code] is the login code.");
    console.log("[command] can be:");
    console.log("   info   - quick, gets info about sheet ");
    console.log("   getall <filename> - slow, downloads latest contents including all updates as a CSV to local file.");
    console.log("   getmin <filename> - This is a a CSV of changed cells, appended with timestamp and user info.");
    console.log("   history <filename> - This is a a CSV where each row is an edit. Includes columns for Version, USer, Timestamp, App, and changes.");
    console.log("   changelog <filename> - downloads full changelog history as JSON to local file.");
    console.log("   refresh - Send a refresh notification.");
}

function main() {
    console.log("TRC Command Line interface");

    if (process.argv.length < 4) {
        usage();
        return;
    }
    var code = process.argv[2];
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
                getFlattenedChangeLog(sheet, filename);
            }
            else if (cmd == 'changelog') {
                var filename = process.argv[4];
                getFullChangeLog(sheet, filename);
            } else if (cmd == "copycode") {
                var newEmail = process.argv[4];
                copyShareCode(sheet, newEmail);
            } else if (cmd == "refresh") {
                refresh(sheet);
            } else {
                console.log("Unrecognized command: " + cmd);
            }

        }, failureFunc);

}

main();
