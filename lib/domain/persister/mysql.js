
var mysql_lib = require("promise-mysql");
var Promise = require("bluebird");

var persister = function(client, tableName) {

    var queryValue = Promise.coroutine(function* (sql, params) {

        var result = yield client.query(sql, params);

        if (result.length > 0) {
            return result[0].value;
        }

        return null;
    });

    var helper = {}

    helper.beginTransaction = function() {
        return client.query("START TRANSACTION");
    }

    helper.commitTransaction = function() {
        return client.query("COMMIT");
    }

    helper.checkTableExists = function() {

        var sql = "SELECT EXISTS(SELECT * FROM information_schema.tables WHERE table_name = ?) as value";
        var params = [tableName];

        return queryValue(sql, params);
    }

    helper.createTable = function() {
        var sql = "CREATE TABLE " + tableName + " (id int, description VARCHAR(500), migrated_at DATETIME)";
        return client.query(sql);
    }

    helper.getLastVersion = function() {
        return queryValue("SELECT id AS value FROM " + tableName + " ORDER BY id DESC LIMIT 1");
    }

    helper.getAll = Promise.coroutine(function* (sql) {
        var result = yield client.query("SELECT id, description, migrated_at FROM " + tableName + " ORDER BY id DESC");

        return result;
    })

    helper.addVersion = function(version, description) {
        return client.query("INSERT INTO " + tableName + " (id, description, migrated_at) VALUES (?, ?, ?)", [ version, description, new Date ]);
    }

    helper.removeVersion = function(version) {
        return client.query("DELETE FROM " + tableName + " WHERE id = ?", [ version ]);
    }

    helper.executeRawQuery = Promise.coroutine(function* (sql) {

        var queries = sql.split(";").filter(function (q) { return q != '' })
        for (var i = 0; i < queries.length; i++) {
            yield client.query(queries[i])
        }

        return;
    });

    helper.done = function() {
        /*if (client) {
            client.done();
        }*/
    }

    return helper;
}

module.exports = {
    create: Promise.coroutine(function* (connectionString, tableName) {
        var connection = yield mysql_lib.createConnection(connectionString);
        return persister(connection, tableName);
    })
}
