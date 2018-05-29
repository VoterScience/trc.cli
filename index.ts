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

import * as runner from 'trc.runplugin/src/core'

declare var process: any;  // https://nodejs.org/docs/latest/api/process.html
declare var require: any;
var fs = require('fs');

function failureFunc(error: core.ITrcError): void {
    console.log("*** failed with " + error.Message);
}

// Dump topology 
// Show this as a depth-first tree. 
function dumpTopology(sheet: sheet.SheetClient, indent?: string): Promise<void> {
    if (!indent) {        
        indent = "";
    }

    return sheet.getInfoAsync().then(info => {
        // console.log(indent + info.Name + " (" + info.CountRecords + ")");
        return sheet.getChildrenAsync().then(children => {
            return ChildMapper.RunSequence(children, 0, child => {
                var filter = child.Filter;

                console.log(indent +"[" + child.Name + "] " + filter);

                var childSheet = sheet.getSheetById(child.Id);
                return dumpTopology(childSheet, indent + "   ");
            });
        });
    });
}

// Download the contents to a file
function getContentsAsync(sheet: sheet.SheetClient, filename: string): Promise<void> {
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
function getRebaseLogAsync(sheet: sheet.SheetClient): Promise<void> {

    return sheet.getRebaseLogAsync().then(result => {
        console.log("got sheet contents");
        return result.ForEach(item => {
            console.log(item);
        });
    });
}

// Download the contents to a CSV file
// This appends additional changelog information. 
function getContents2Async(sheet: sheet.SheetClient, filename: string): Promise<void> {
    console.log("Downloading contents to file (append $user, $app): " + filename);
    return sheet.getInfoAsync().then(info => {
        console.log("Sheet has " + info.CountRecords + " rows.")

        return getFlattenedChangeLogAsync(sheet, null).then(map => {
            return sheet.getSheetContentsAsync().then(contents => {
                var cRecId: string[] = contents["RecId"];

                // Append additional columns. 
                var cApp: string[] = [];
                contents["$App"] = cApp;

                var cUser: string[] = [];
                contents["$User"] = cUser;

                var cIpAddress: string[] = [];
                contents["$IpAddress"] = cIpAddress;

                var cFirstDate: string[] = [];
                contents["$ServerFirstDate"] = cFirstDate;

                var cLastDate: string[] = [];
                contents["$ServerLastDate"] = cLastDate;


                var cClientTimestamp: string[] = [];
                contents["$ClientTimestamp"] = cClientTimestamp;

                var cLat: string[] = [];
                contents["$ClientLat"] = cLat;

                var cLong: string[] = [];
                contents["$ClientLong"] = cLong;

                var cServerLat: string[] = [];
                contents["$UploadLat"] = cServerLat;

                var cServerLong: string[] = [];
                contents["$UploadLong"] = cServerLong;


                //console.log('XXX');
                for (var i in cRecId) {
                    var recId = cRecId[i];
                    var x: ExtraInfo = getX(map, recId);

                    cUser.push(x.User);
                    cApp.push(x.App);
                    cFirstDate.push(x.FirstDate);
                    cLastDate.push(x.LastDate);

                    cIpAddress.push(x.IpAddress);
                    cClientTimestamp.push(x.ClientTimestamp);

                    cLat.push(x.ClientLat);
                    cLong.push(x.ClientLong);
                    cServerLat.push(x.Lat);
                    cServerLong.push(x.Long);
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
function getFullChangeLogAsync(sheet: sheet.SheetClient, filename: string): Promise<void> {
    console.log("Downloading full change log to file: " + filename);
    return sheet.getInfoAsync().then(info => {
        console.log("Sheet has " + info.LatestVersion + " changes.")

        var buffer: string = "";
        return sheet.getDeltaRangeAsync().then(iter => {
            return iter.ForEach(item => {
                var x = JSON.stringify(item);
                buffer += x;
            });
        }).then(() => {
            fs.writeFile(filename, buffer);
        })
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
    App: string;

    // These are "server" values, captured by when the server receives the request
    Timestamp: string;
    FirstDate: string;
    LastDate: string;
    IpAddress: string; // $$$ error: this is missing from the REST call. 

    // These are "client" values. Captured wehen the client recorded it. 
    // necessary in  offline scenarios, but could be spoofed. 
    ClientTimestamp: string;
    ClientLat: string;
    ClientLong: string;

    // These are provided when the client uploads (and hence once it's regained connectivity)
    Lat: string;
    Long: string;


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

    public SetIpAddress(ipAddress: string): void {
        if (!this.IpAddress) {
            this.IpAddress = ipAddress;
        }
    }

    // "Client" values are recorded by the client. 
    // These may be more accurate in offline scenarios. 
    // But a bad client could spoof them. 
    public SetClientTimestamp(timestamp: string): void {
        this.ClientTimestamp = timestamp;
    }
    public SetClientLat(lat: string): void {
        if (!this.ClientLat) {
            this.ClientLat = lat;
        }
    }
    public SetClientLong(long: string): void {
        if (!this.ClientLong) {
            this.ClientLong = long;
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
function getFlattenedChangeLogAsync(sheet: sheet.SheetClient, filename: string): Promise<IDeltaMap> {

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
                                var x: ExtraInfo = getX(map, recId);
                                x.SetApp(result.App);
                                x.SetUser(result.User);
                                x.SetLat(result.GeoLat, result.GeoLong);
                                x.SetTimestamp(result.Timestamp);
                                x.SetIpAddress(result.UserIp);

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

                                if (columnName == "XLastModified") {
                                    x.SetClientTimestamp(newValue);
                                } else if (columnName == "XLat") {
                                    x.SetClientLat(newValue);
                                } else if (columnName == "XLong") {
                                    x.SetClientLong(newValue);
                                }
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
                            // $$$ callback which resolves() 
                            fs.writeFile(filename, csv);
                        }
                        resolve(map); // Finish promise.  
                    });
                });
            });
        });
}

// RecId --> SheetId
interface IChildMap {
    [recId: string]: string;
}

interface ISheetInfoCache {
    [sheetId: string]: sheet.ISheetInfoResult;
}

class ChildMapper {
    private _map: IChildMap = {};
    private _sheetInfoCache: ISheetInfoCache = {};

    public runAsync(sheet: sheet.SheetClient): Promise<void> {
        return sheet.getInfoAsync().then((info) => {
            this._sheetInfoCache[sheet.getId()] = info;
            console.log("** adding " + sheet.getId() + "  " + info.Name);

            return sheet.getRecIdsAsync().then((contents) => {
                var recIds = contents["RecId"];
                for (var i in recIds) {
                    var recId = recIds[i];

                    this._map[recId] = sheet.getId();
                }

                // Now recursively apply to children 
                // Do breadth-first traversal so that deepest-child writes lasts. 
                return sheet.getChildrenAsync().then(children => {

                    return ChildMapper.RunSequence(children, 0, child => {
                        var sheetChild = sheet.getSheetById(child.Id);
                        return this.runAsync(sheetChild);
                    });

                });
            });
        });
    }

    // Iterate through the array in sequence. 
    // invoke Callback(item) on each item in the array. 
    public static RunSequence<T>(items: T[], idx: number, callback: (item: T) => Promise<void>): Promise<void> {
        if (idx == items.length) {
            return Promise.resolve();
        }

        var item = items[idx];
        return callback(item).then(() => {
            return ChildMapper.RunSequence<T>(items, idx + 1, callback);
        });
    }

    public getSheetInfo(sheetId: string): sheet.ISheetInfoResult {
        return this._sheetInfoCache[sheetId];
    }
    public getMap(): IChildMap {
        return this._map;
    }
}

// Get the child-most sheet for each record
function getChildMapAsync(sheet: sheet.SheetClient, filename: string): Promise<void> {
    var mapper = new ChildMapper();
    return mapper.runAsync(sheet).then(() => {
        console.log("**---------------");

        var data: ISheetContents = {};
        var colRecId: string[] = [];
        var colSheetName: string[] = [];
        var colSheetId: string[] = [];
        var colSheetVer: string[] = [];

        data["RecId"] = colRecId;
        data["SheetName"] = colSheetName;
        data["SheetId"] = colSheetId;
        data["SheetVersion"] = colSheetVer;

        var map = mapper.getMap();
        for (var recId in map) {
            //var recId = map[i];
            var sheetId = map[recId];

            var sheetInfo = mapper.getSheetInfo(sheetId);
            if (!sheetInfo) {
                console.log("???" + sheetId);
            }
            var sheetName = sheetInfo.Name;

            colRecId.push(recId);
            colSheetName.push(sheetName);
            colSheetVer.push(sheetInfo.LatestVersion.toString());
            colSheetId.push(sheetId);
        }

        console.log(">> writing CSV:")
        var csv = SheetContents.toCsv(data);
        return Config.WriteFileAsync(filename, csv).then(() => {
            console.log(">> done!");
        });
    });
}

// Queue a refresh operation and wait for it to complete. 
// Afer this, we should see a new row in the rebaseLog. 
function refreshAsync(s: sheet.SheetClient): Promise<void> {
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
    console.log("-auth [keyfile] -sheet [sheet] [command] [args]");
    console.log();
    console.log("    where [keyfile] is a filename with the passkey. (will launch a login if file doesn't exist)");
    console.log();
    console.log("[command] can be:");
    console.log("   info   - quick, gets info about sheet ");
    console.log("   getall <filename> - slow, downloads latest contents including all updates as a CSV to local file.");
    console.log("   getall2 <filename> - getall with appended metadata columns");
    //console.log("   getmin <filename> - This is a a CSV of changed cells, appended with timestamp and user info.");
    console.log("   history <filename> - This is a a CSV where each row is an edit. Includes columns for Version, User, Timestamp, App, and changes.");
    console.log("   changelog <filename> - downloads full changelog history as JSON to local file.");
    console.log("   getChildMap <filename> - get a CSV that maps from RecId to deepest child sheet containing it.")
    console.log("   refresh - Send a refresh notification.");
}

class Config {
    public Url: string; // TRC server endpoint 

    public httpClient: XC.XClient; // http channel, includes auth token     
    public userClient: core.UserClient; // wrapper for user apis 
    public sheetClient: sheet.SheetClient; // sheetId + httpClient 


    public Cmd: string; // the command to execute
    public CmdArgs: string[]; // arguments to this command

    public sheetId: string;
    public _jwtPath: string;

    public constructor() {
        this.Url = "https://TRC-login.voter-science.com";
        this.httpClient = null;
        this.sheetClient = null;
        this.userClient = null;
        this._jwtPath = null;
        this.sheetId = null;
    }

    // Promisified wrapper to Write  contents of a file
    // fs.writeFile(filename, str);
    public static WriteFileAsync(path: string, contents: string): Promise<void> {
        return new Promise<void>(
            (
                resolve: () => void,
                reject: (error: any) => void) => {

                fs.writeFile(path, contents, (err: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            }
        );
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
        while (i < process.argv.length) {
            var val = process.argv[i];

            var param = null;
            if (val[0] == '-' && i < process.argv.length - 1) {
                param = process.argv[i + 1];
            }
            if (val == "-?") {
                return Promise.reject("usage:");
            }
            if (val == "-auth") {

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
            return Promise.reject("Error: missing -auth parameter");
        }

        return this.GetLoginOrWait().then((contents) =>
        {
            var creds = <runner.Credentials> JSON.parse(contents);

            if (!this.sheetId)
            {
                this.sheetId = creds.SheetId
            }

            var jwt = creds.AuthToken;
            {
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
            }
        });
    }


    private PollForLogin(
        resolve: (val : string) => void,
        reject: (error: any) => void
    ): void {
        Config.ReadFileAsync(this._jwtPath).then((json) => {
            return resolve(json);
        }).catch( () => {            
            // Try again in 1 second
            setTimeout( ()=> { this.PollForLogin(resolve, reject) }, 1000);
        });
    }

    public WaitForLogin(): Promise<string> {
        return new Promise<string>(
            (
                resolve: (val : string) => void,
                reject: (error: any) => void
            ) => 
            {

                
                this.PollForLogin(resolve, reject)
            }
        );
    }

    public GetLoginOrWait(): Promise<string> {
        return Config.ReadFileAsync(this._jwtPath).then((json) => {
            return Promise.resolve(json);
        }).catch( ()=> {
            // Print this one time, and then poll for a response. 
            console.log("Can't find JWT file: " + this._jwtPath);
            console.log("Login on now to create it");

            var x = new runner.Runner();
            var cfg = new runner.RunnerConfig();            
            cfg.dir = "x";
            cfg.authFile = this._jwtPath;                   
            
            x.start(cfg);

            // Block here until file is written? 
            return this.WaitForLogin().then( (str) => {
                x.stop(); // Needed so we can exit
                return str;
            });
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
            // Show information about current sheet and user token. 
            info(config.userClient, config.sheetClient);
        }
        else if (cmd == 'getall') {
            // Gets the raw contents. 
            var filename = config.CmdArgs[0];
            return getContentsAsync(config.sheetClient, filename);
        }
        else if (cmd == 'getall2') {
            // Gets raw contents amended with additioanl columns of metadata 
            var filename = config.CmdArgs[0];
            return getContents2Async(config.sheetClient, filename);
        }
        else if (cmd == 'history') {
            // Get CSV of all changes 
            var filename = config.CmdArgs[0];
            return getFlattenedChangeLogAsync(config.sheetClient, filename).then(() => { });
        }
        else if (cmd == 'changelog') {
            // Get high-fidelity JSON file of all changes. 
            var filename = config.CmdArgs[0];
            return getFullChangeLogAsync(config.sheetClient, filename);
        }
        /*else if (cmd == "copycode") {
            var newEmail = process.argv[4];
            copyShareCode(sheetClient, newEmail);
        } */
        else if (cmd == 'rebaselog') {
            // Get log of rebases (updates to S0 sheet)
            // Whereas changelog is the user-submitted changes  that bump up version number.
            return getRebaseLogAsync(config.sheetClient);
        }
        else if (cmd == "refresh") {
            // Invasive command to update S0. 
            return refreshAsync(config.sheetClient);
        }
        else if (cmd == "getchildmap") {
            var filename = config.CmdArgs[0];
            return getChildMapAsync(config.sheetClient, filename);
        }
        else if (cmd == "topology")
        {
            return dumpTopology(config.sheetClient);
        }
        else {
            console.log("Unrecognized command: " + cmd);
            usage();
        }
    }).catch((error: any) => {
        console.log(error);
        usage();
    });
}

main();
