const Sequelize = require("sequelize");

// setup a new database using database credentials set in .env
const sequelize = new Sequelize(
    "database",
    'clio_user',
    'clio_password',
    {
        host: "0.0.0.0",
        dialect: "sqlite",
        pool: {
            max: 5,
            min: 0,
            idle: 10000
        },
        storage: "db/database.sqlite"
    }
);

const Entry = sequelize.define("entries", {
    id: { primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
    entryId: { type: Sequelize.STRING },
    parentId: { type: Sequelize.STRING, allowNull: true },
    details: { type: Sequelize.TEXT, allowNull: true },
    imported: { type: Sequelize.BOOLEAN, defaultValue: false },
    batchDone: { type: Sequelize.BOOLEAN, defaultValue: false },
});

// authenticate with the database
sequelize
    .authenticate()
    .then(function(err) {
        Entry.sync({ force: true})
        console.log("Sqlite connection established.");
    })
    .catch(function(err) {
        console.log("Unable to connect to database: ", err);
    });

module.exports = { Entry }