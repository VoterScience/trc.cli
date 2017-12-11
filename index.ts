#! /usr/bin/env node

// See details for making a command line tool 
// http://blog.npmjs.org/post/118810260230/building-a-simple-command-line-tool-with-npm 

// Tips for type-resolution errors with bluebird. 
// https://stackoverflow.com/questions/37028649/error-ts2307-cannot-find-module-bluebird

import * as XC from 'trc-httpshim/xclient'
import * as core from 'trc-core/core'
import * as common from 'trc-httpshim/common'
import * as sheet from 'trc-sheet/sheet'
import { SheetContentsIndex, SheetContents, ISheetContents } from 'trc-sheet/sheetContents';



declare var process: any;  // https://nodejs.org/docs/latest/api/process.html
declare var require: any;
var fs = require('fs');

function failureFunc(error: core.ITrcError): void {
    console.log("*** failed with " + error.Message);
}

// Download the contents to a file
function getContents(sheet: sheet.SheetClient, filename: string): Promise<void> {
    console.log("Downloading contents to file: " + filename);
    return sheet.getInfoAsync().then(info => {
        console.log("Sheet has " + info.CountRecords + " rows.")
        return sheet.getSheetContentsAsync().then(contents => {
            var str = SheetContents.toCsv(contents);
            fs.writeFile(filename, str);
        });

        // Show info about user 
    });
}

// Download the rebase log. 
// This is the set of edits to s0. 
function getRebaseLog(sheet: sheet.SheetClient): Promise<void> {

    return sheet.getRebaseLogAsync().then(result => {
        console.log("got sheet contents");
        return result.ForEach(item => {
            console.log(item);
        });
    });
}

$$$ For Getall2, include the offline fields (time, lat, long) 

// Download the contents to a CSV file
// This appends additional changelog information. 
function getContents2(sheet: sheet.SheetClient, filename: string): Promise<void> {
    console.log("Downloading contents to file (append $user, $app): " + filename);
    return sheet.getInfoAsync().then(info => {
        console.log("Sheet has " + info.CountRecords + " rows.")

        return getFlattenedChangeLog(sheet, null).then(map => {
            return sheet.getSheetContentsAsync().then(contents => {
                var cRecId: string[] = contents["RecId"];

                var cApp: string[] = [];
                contents["$App"] = cApp;

                var cUser: string[] = [];
                contents["$User"] = cUser;

                var cFirstDate: string[] = [];
                contents["$FirstDate"] = cFirstDate;

                var cLastDate: string[] = [];
                contents["$LastDate"] = cLastDate;

                //console.log('XXX');
                for (var i in cRecId) {
                    var recId = cRecId[i];
                    var x = getX(map, recId);

                    cUser.push(x.User);
                    cApp.push(x.App);
                    cFirstDate.push(x.FirstDate);
                    cLastDate.push(x.LastDate);
                }
                //console.log('XXX2');

                var str = SheetContents.toCsv(contents);
                fs.writeFile(filename, str);
                //console.log('XXX3');
            });
        });
        // Show info about user 
    });
}

// Download the change log as json
// this is a high-fidelity capture of all the individual changes. 
function getFullChangeLog(sheet: sheet.SheetClient, filename: string): Promise<void> {
    console.log("Downloading full change log to file: " + filename);
    return sheet.getInfoAsync().then(info => {
        console.log("Sheet has " + info.LatestVersion + " changes.")

        return sheet.getDeltaRangeAsync().then(iter => {
            return iter.ForEach(item => {
                var x = JSON.stringify(item);
                fs.writeFile(filename, x);
            });
        });
    });
}

/*
// Create a new share code for this sheet 
function copyShareCode(sheet: trc.Sheet, newEmail: string): void {
    console.log("Creating new share code for:" + newEmail);
    var requireFacebook = true;
    sheet.createShareCode(newEmail, requireFacebook, (newCode) => {
        console.log("New code is:  " + newCode);
    });
}
*/

// Information accumulated from change-log. 
class ExtraInfo {
    User: string;
    Lat: string;
    Long: string;
    Timestamp: string;
    FirstDate: string;
    LastDate: string;
    App: string;


    public SetUser(user: string): void {
        if (user != null) {
            this.User = user;
        }
    }

    public SetApp(app: string): void {
        if (app != null) {
            this.App = app;
        }
    }

    public SetTimestamp(timestamp: string): void {
        this.Timestamp = timestamp;

        if (timestamp) {
            var ts = Date.parse(timestamp);
            if (!this.FirstDate) {
                this.FirstDate = timestamp;
            } else {
                var firstDateMS = Date.parse(this.FirstDate);
                if (ts < firstDateMS) {
                    this.FirstDate = timestamp;
                }
            }

            if (!this.LastDate) {
                this.LastDate = timestamp;
            } else {
                var lastDateMS = Date.parse(this.FirstDate);
                if (ts > lastDateMS) {
                    this.LastDate = timestamp;
                }
            }
        }

    }

    public SetLat(lat: string, long: string): void {
        if (lat != null && lat != "0") {
            this.Lat = lat;
            this.Long = long;
        }
    }
}

// Mapping of extra information per RecId
interface IDeltaMap {
    [recId: string]: ExtraInfo;
}

function getX(map: IDeltaMap, recId: string): ExtraInfo {
    var x = map[recId];
    if (x == undefined) {
        x = new ExtraInfo();
        map[recId] = x;
    }
    return x;
}

// Each change can actually be an arbitrary rectangle size, although they're commonly a 1x1.
// So flatten it so that it can be viewed in a CSV.
// This means a we'll get multiple rows with the same version number.
function getFlattenedChangeLog(sheet: sheet.SheetClient, filename: string): Promise<IDeltaMap> {

    return new Promise<IDeltaMap>(
        (
            resolve: (result: IDeltaMap) => void,
            reject: (error: any) => void
        ) => {
            var map: IDeltaMap = {};

            console.log("Downloading change log to file: " + filename);
            sheet.getInfoAsync().then(info => {
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


                sheet.getDeltaRangeAsync().then(iter => {
                    iter.ForEach(result => {
                        try {

                            // Flatten the result.Change. 
                            SheetContents.ForEach(result.Value, (recId, columnName, newValue) => {
                                var x = getX(map, recId);
                                x.SetApp(result.App);
                                x.SetUser(result.User);
                                x.SetLat(result.GeoLat, result.GeoLong);
                                x.SetTimestamp(result.Timestamp);

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
                    }).then(() => {
                        // Done 
                        console.log("Done: " + cChangeRecId.length);

                        if (filename != null) {
                            var csv = SheetContents.toCsv(contents);
                            fs.writeFile(filename, csv);
                        }
                        resolve(map); // Finish promise.  
                    });
                });
            });
        });
}

function refresh(s: sheet.SheetClient): Promise<void> {
    console.log("Send refresh notification... ");
    var admin = new sheet.SheetAdminClient(s);
    return admin.postOpRefreshAsync().then(() => {
        console.log("  refresh posted. Waiting...");
        return admin.WaitAsync();
    }).then(() => {
        console.log("Refresh complete!");
    });
}

// Get information about the sheet
function info(
    user: core.UserClient,
    sheet: sheet.SheetClient): Promise<void> {


    return user.getUserInfoAsync().then(info => {
        console.log("User email: " + info.Name);
        console.log("USer id   : " + info.Id);
        if (sheet != null) {
            console.log();
            console.log("Sheet info:");
            return sheet.getInfoAsync().then(info => {
                console.log("Name:    " + info.Name);
                console.log("PName:   " + info.ParentName);
                console.log("SheetId: " + sheet.getId());
                console.log("ver:     " + info.LatestVersion);
                console.log("records: " + info.CountRecords);
            });
        } else {
            return Promise.resolve();
        }
    });
}

function usage() {
    console.log("-jwt [keyfile] -sheetId [sheet] [command] [args]");
    console.log();
    console.log("where [keyfile] is a filename with the passkey.");
    console.log("[command] can be:");
    console.log("   info   - quick, gets info about sheet ");
    console.log("   getall <filename> - slow, downloads latest contents including all updates as a CSV to local file.");
    //console.log("   getmin <filename> - This is a a CSV of changed cells, appended with timestamp and user info.");
    console.log("   history <filename> - This is a a CSV where each row is an edit. Includes columns for Version, User, Timestamp, App, and changes.");
    console.log("   changelog <filename> - downloads full changelog history as JSON to local file.");
    console.log("   refresh - Send a refresh notification.");
}

class Config {
    public Url: string; // TRC server endpoint 

    public httpClient: XC.XClient; // http channel, includes auth token     
    public userClient: core.UserClient; // wrapper for user apis 
    public sheetClient: sheet.SheetClient; // sheetId + httpClient 


    public Cmd: string;
    public CmdArgs: string[];

    public sheetId: string;
    private _jwtPath: string;

    public constructor() {
        this.Url = "https://TRC-login.voter-science.com";
        this.httpClient = null;
        this.sheetClient = null;
        this.userClient = null;
        this._jwtPath = null;
        this.sheetId = null;
    }

    // Promisified wrapper to Read contents of a file
    private static ReadFileAsync(path: string): Promise<string> {
        return new Promise<string>(
            (
                resolve: (value: string) => void,
                reject: (error: any) => void) => {
                fs.readFile(path, (err: any, data: string) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            }
        );
    }

    public InitAsync(): Promise<void> {
        var i = 2;
        while (true) {
            var val = process.argv[i];
            var param = null;
            if (val[0] == '-' && i < process.argv.length - 1) {
                param = process.argv[i + 1];
            }
            if (val == "-?") {
                return Promise.reject("usage:");
            }
            if (val == "-jwt") {

                this._jwtPath = param;
                i += 2;
                continue;
            }
            if (val == "-sheet") {
                this.sheetId = param;
                i += 2;
                continue;
            }
            
            // Unrecognized.
            break;
        }

        // Now do initialization 
        if (this._jwtPath == null) {
            return Promise.reject("Error: missing -jwt parameter");
        }

        return Config.ReadFileAsync(this._jwtPath).then((jwt) => {
            this.httpClient = XC.XClient.New(this.Url, jwt, null);
            this.userClient = new core.UserClient(this.httpClient);

            if (this.sheetId != null) {
                this.sheetClient = new sheet.SheetClient(this.httpClient, this.sheetId);
            }

            this.Cmd = process.argv[i].toLowerCase();
            
            console.log("Command: " + this.Cmd);
            i++;

            // Copy rest of args 
            this.CmdArgs = [];
            while (i < process.argv.length) {
                this.CmdArgs.push(process.argv[i])
                i++;
            }
        });
    }
}

function main() {
    console.log("TRC Command Line interface");


    // Parse command lines     
    var config = new Config();
    config.InitAsync().then(() => {
        var cmd = config.Cmd;

        if (cmd == 'info') {
            info(config.userClient, config.sheetClient);
        }
        else if (cmd == 'getall') {
            // Gets the raw contents. 
            var filename = config.CmdArgs[0];
            getContents(config.sheetClient, filename);
        }
        else if (cmd == 'history') {
            var filename = config.CmdArgs[0];
            getFlattenedChangeLog(config.sheetClient, filename);
        }
        else if (cmd == 'changelog') {
            var filename = config.CmdArgs[0];
            getFullChangeLog(config.sheetClient, filename);
        }
        /*else if (cmd == "copycode") {
            var newEmail = process.argv[4];
            copyShareCode(sheetClient, newEmail);
        } */
        else if (cmd == "refresh") {
            refresh(config.sheetClient);
        }
        else if (cmd == 'getall2') {
            var filename = config.CmdArgs[0];
            getContents2(config.sheetClient, filename);
        }
        else if (cmd == 'rebaselog') {
            getRebaseLog(config.sheetClient);
        }
        else {
            console.log("Unrecognized command: " + cmd);
            usage();
        }
    }).catch((error) => {
        console.log(error);
        usage();
    });
}

main();
