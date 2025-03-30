const oracledb = require('oracledb');

const dbConfig = {
  user: "SYSTEM",
  password: "pmysql",
  connectString: "localhost:1521/XE"
};

async function executeQuery(query, binds = {}, options = {}, returnConnection = false) {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(query, binds, options);
        
        if (returnConnection) {
            // Return both the result and the connection when we need to keep the connection open
            return { result, connection };
        } else {
            // For regular queries, close the connection and return just the result
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error("Error closing connection:", err);
                }
            }
            return result;
        }
    } catch (err) {
        // Always close the connection on error unless we're returning it
        if (connection && !returnConnection) {
            try {
                await connection.close();
            } catch (closeErr) {
                console.error("Error closing connection:", closeErr);
            }
        }
        console.error("Oracle DB Error:", err);
        throw err;
    }
}

module.exports = { executeQuery };