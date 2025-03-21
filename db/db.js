const oracledb = require('oracledb');

const dbConfig = {
  user: "SYSTEM",
  password: "pmysql",
  connectString: "localhost:1521/XE"
};

async function executeQuery(query, binds = []) {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(query, binds, { autoCommit: true });
        return result;
    } catch (err) {
        console.error("Oracle DB Error:", err);
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

module.exports = { executeQuery };

