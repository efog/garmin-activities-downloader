/* eslint-disable no-undef */
const { GarminApi } = require("garmin-api-handler");
const { command } = require("commander");
const co = require("co");
const commander = require("commander");
const debug = require("debug")("debug:index:gad");
const error = require("debug")("error:index:gad");
const fetch = require("node-fetch");
const fs = require("fs");
const info = require("debug")("info:index:gad");
const parseString = require("xml2js").parseString;
const path = require("path");
const prompt = require("prompt-promise");
const warn = require("debug")("warn:index:gad");

const garminApi = new GarminApi("");
const program = commander.createCommand();

program.version("0.0.1");

if (!globalThis.fetch) {
    globalThis.fetch = fetch;
    global.Request = fetch.Request;
    global.Headers = fetch.Headers;
    global.Response = fetch.Response;
    global.Body = fetch.Body;
}

/**
 * Gets login details (email + password)
 * @returns {Object} session
 */
async function getLoginDetails() {
    debug("reading user inputs");
    const email = await prompt("email: ");
    const password = await prompt.password("password: ");
    return {
        "email": email,
        "password": password
    };
}

/**
 * Logins users to garmin connect api.
 * @param {Object} loginDetails Garmin login details
 * @returns {Object} signin session details
 */
async function login(loginDetails) {
    debug("logins to garmin connect api");
    const sessionId = await garminApi.login(loginDetails.email, loginDetails.password);
    debug(`got session id ${sessionId}`);
    return sessionId;
}

/**
 * Gets user's activities
 * @param {Number} limit maximum number of activities to fetch
 * @returns {Object} activities list
 */
async function getActivities(limit = 10) {
    debug(`getting ${limit} activities`);
    const activities = await garminApi.getActivities({ "limit": limit });
    debug(`got ${activities.length} activities`);
    return activities;
}

/**
 * Gets activity GPX data by ID
 * @param {String} activityId activity identifier
 * @returns {String} activity gpx data downloaded
 */
async function getActivityGPX(activityId) {
    debug(`getting activity by id ${activityId}`);
    const data = await garminApi.getActivityGpx(activityId);
    debug(`got GPX data ${data.length}`);
    return data;
}

/**
 * Saves activity data
 * @param {Activity} activity activity JSON data
 * @param {GPX} gpxData activity gpx data
 * @param {String} basePath output files base path
 * @returns {undefined}
 */
async function saveData(activity, gpxData, basePath) {
    if (!fs.existsSync(basePath)) {
        throw new Error(`base path ${basePath} doesn't exist`);
    }
    const activityFilePath = path.join(basePath, `${activity.id}.json`);
    const activityGpxFilePath = path.join(basePath, `${activity.id}.gpx.xml`);
    if (fs.existsSync(activityFilePath)) {
        fs.unlinkSync(activityFilePath);
    }
    if (fs.existsSync(activityGpxFilePath)) {
        fs.unlinkSync(activityGpxFilePath);
    }
    fs.writeFileSync(activityFilePath, JSON.stringify(activity));
    fs.writeFileSync(activityGpxFilePath, gpxData);
}

const download = program.command("download <destination>")
    .option("-l, --limit <number>", "number of activities to download", parseInt)
    .description("downloads activities to specific destination");
download.action(async (destination) => {
    info("downloading actvities");
    debug(`downloading to ${destination}`);
    const loginDetails = await getLoginDetails();
    const sessionId = await login(loginDetails);
    const activities = await getActivities(download.limit);
    for (let index = 0; index < activities.length; index++) {
        const element = activities[index];
        debug(`processing activity id ${element.id}`);
        const gpxData = await getActivityGPX(element.id);
        debug(`saving to ${destination}`);
        await saveData(element, gpxData, destination);
    }
}).parse(process.argv);