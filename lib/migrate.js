"use strict";

var fs = require("fs");
var path = require("path");
var colors = require("./colors");
var Promise = require("bluebird");
var printStatus = require("./status");
var messages = require("./infrastructure/messages");

var migrate = Promise.coroutine(function* (options) {

    var connectionString = options.connectionString;
    var targetVersion = options.targetVersion || 0;
    var currentPath = options.path || ".";
    var tableName = options.tableName || "migrations";

    var persisterProvider = require("./domain/persister/" + options.db_driver || "postgres");

    try {
        var persister = yield persisterProvider.create(connectionString, tableName);
        
        yield persister.beginTransaction();
        
        var migrationService = getMigrationService(persister);

        var currentVersion = yield migrationService.migrate(currentPath, targetVersion);

        yield persister.commitTransaction();

        persister.done();

        console.log(colors.info("--------------------------------------------------"));
        console.log(colors.info(messages.MIGRATION_COMPLETED + (currentVersion ? currentVersion : messages.INITIAL_STATE)));

    } catch(error) {

        if (error) {
            console.error(colors.error(messages.MIGRATION_ERROR + error));
        }

        if (persister) {
            persister.done();
        }

        throw error;
    };

    if (options.printStatus) {
        yield printStatus(options);
    }
});

var getMigrationService = function (persister) {

    var MigratorService = require("./application/service/migrator-service");
    var ScriptService = require("./domain/service/script-service");
    var VersionService = require("./domain/service/version-service");
    var ScriptRepository = require("./domain/repository/script-repository");
    var VersionRepository = require("./domain/repository/version-repository");

    return new MigratorService(
        new ScriptService(new ScriptRepository(fs, persister), path),
        new VersionService(new VersionRepository(persister), messages),
        messages);
};

module.exports = migrate;
