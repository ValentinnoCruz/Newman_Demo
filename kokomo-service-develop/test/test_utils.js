function getRandomId(length) {
    let result = '';
    const characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

function initializeEnvironment(initializeDB=false) {
    process.env.DB_TYPE = 'sqlite';
    process.env.CONFIG_CACHE_TIME_SECONDS = "1"
    if(initializeDB)
    {
        if(!process.env.SQLITE_DB_FILENAME)
        {
            process.env.SQLITE_DB_FILENAME = `${getRandomId(10)}.sqlite`
        }
        const db = require('../src/utils/dbUtils')
        let dbInstance = db.getDBInstance() // create db with name SQLITE_DB_FILENAME
        console.info(`Creating test db with name ${process.env.SQLITE_DB_FILENAME}`)
        return dbInstance
    }
}

module.exports = {
    getRandomId,
    initializeEnvironment
}
