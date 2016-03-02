"use strict";

var fs = require("fs");
var _ = require("lodash");
var path = require("path");
var colors = require("./colors");
var Promise = require("bluebird");
var messages = require("./infrastructure/messages");
var ScriptService = require("./domain/service/script-service");
var VersionService = require("./domain/service/version-service");
var ScriptRepository = require("./domain/repository/script-repository");
var VersionRepository = require("./domain/repository/version-repository");

var status = Promise.coroutine(function* (options) {

    var connectionString = options.connectionString;
    var currentPath = options.path || ".";
    var tableName = options.tableName || "version";

    var persisterProvider = require("./domain/persister/" + options.db_driver || "postgres");

    try {
        var persister = yield persisterProvider.create(connectionString, tableName);

        var scriptService = new ScriptService(new ScriptRepository(fs, persister), path);
        var versionService = new VersionService(new VersionRepository(persister), messages);

        var scriptVersions = scriptService.getList(currentPath, 1);
        var dbVersions = yield versionService.getAll();

        console.log(colors.grey("\n----------------- Database Status ----------------\n"));
        console.log(colors.grey("Version | Migrated At | Description --------------\n"));

        var middleColumnSize = new Date().toLocaleString().length;
        var notMigratedMsg = _.pad(messages.NOT_MIGRATED, middleColumnSize)
        var line

        scriptVersions.forEach(function(v) {
            if (dbVersions[v.version]) {
                line = [v.version, dbVersions[v.version].migrated_at, v.description].join(" | ");
                delete dbVersions[v.version];
                console.log(colors.info(line));
            } else {
                line = [v.version, notMigratedMsg, v.description].join(" | ");
                console.log(colors.warn(line));
            }
        });

        if (_.size(dbVersions) > 0) {
            console.log("\nMissing files ------------------------------------\n");

            _.forOwn(dbVersions, function(info) {
                line = [info.version, info.migrated_at, info.description].join(" | ")
                console.log(colors.error(line));
            });
        }
        console.log("");

        persister.done();


    } catch(error) {

        if (error) {
            console.log(error.stack);
            console.error(colors.error(messages.MIGRATION_ERROR + error));
        }

        if (persister) {
            persister.done();
        }

        throw error;
    };
});

module.exports = status;
