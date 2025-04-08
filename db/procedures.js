const { executeQuery } = require('./db');

async function createGetUsersProcedure() {
    const procQuery = `
        CREATE OR REPLACE PROCEDURE GET_USERS(users OUT SYS_REFCURSOR) 
        AS 
        BEGIN 
            OPEN users FOR 
            SELECT ID, USERNAME, PASSWORD FROM users; 
        END;
    `;

    try {
        await executeQuery(procQuery, {});
        console.log("Stored Procedure 'GET_USERS' created successfully.");
    } catch (err) {
        console.error("Error creating stored procedure 'GET_USERS':", err);
    }
}

async function initializeProcedures() {
    await createGetUsersProcedure();
}


module.exports = { initializeProcedures };
