const { executeQuery } = require('./db');

async function createRegisterDonorProcedure() {
    const procQuery = `
        CREATE OR REPLACE PROCEDURE REGISTER_DONOR (
            p_name IN donors.name%TYPE,
            p_phone IN donors.phone%TYPE,
            p_password IN donors.password%TYPE,
            p_dob IN VARCHAR2,
            p_gender IN donors.gender%TYPE,
            p_blood_group IN donors.blood_group%TYPE,
            p_address IN donors.address%TYPE,
            p_health_status IN donors.health_status%TYPE,
            p_last_donation_date IN VARCHAR2,
            p_weight IN donors.weight%TYPE
        )
        AS
        BEGIN
            INSERT INTO donors (name, phone, password, dob, gender, blood_group, address, health_status, last_donation_date, weight)
            VALUES (p_name, p_phone, p_password,TO_DATE(p_dob, 'YYYY-MM-DD'),p_gender,p_blood_group,p_address,p_health_status,TO_DATE(p_last_donation_date, 'YYYY-MM-DD'),p_weight);
            COMMIT;
        END;

    `;

    try {
        await executeQuery(procQuery, {});
        console.log("Stored Procedure 'REGISTER_DONOR' created successfully.");
    } catch (err) {
        console.error("Error creating 'REGISTER_DONOR':", err);
    }
}

async function createRegisterAdminProcedure() {
    const procQuery = `
        CREATE OR REPLACE PROCEDURE REGISTER_ADMIN (
            p_name IN administrators.name%TYPE,
            p_blood_bank_id IN administrators.blood_bank_id%TYPE,
            p_address IN administrators.address%TYPE,
            p_phone IN administrators.phone%TYPE,
            p_password IN administrators.password%TYPE
        )
        AS
        BEGIN
            INSERT INTO administrators (name, blood_bank_id, address, phone, password)
            VALUES (p_name, p_blood_bank_id, p_address, p_phone, p_password);
            COMMIT;
        END;
    `;

    try {
        await executeQuery(procQuery, {});
        console.log("Stored Procedure 'REGISTER_ADMIN' created successfully.");
    } catch (err) {
        console.error("Error creating 'REGISTER_ADMIN':", err);
    }
}

async function createLoginDonorProcedure() {
    const procQuery = `
        CREATE OR REPLACE PROCEDURE LOGIN_DONOR(
            p_name IN VARCHAR2,
            p_password IN VARCHAR2,
            is_valid OUT NUMBER
        )
        AS
            v_count NUMBER;
        BEGIN
            SELECT COUNT(*) INTO v_count
            FROM donors
            WHERE name = p_name AND password = p_password;

            is_valid := v_count;
        END;

    `;

    try {
        await executeQuery(procQuery, {});
        console.log("Stored Procedure 'LOGIN_DONOR' created successfully.");
    } catch (err) {
        console.error("Error creating 'LOGIN_DONOR':", err);
    }
}

async function createLoginAdminProcedure() {
    const procQuery = `
        CREATE OR REPLACE PROCEDURE LOGIN_ADMIN(
            p_name IN VARCHAR2,
            p_password IN VARCHAR2,
            is_valid OUT NUMBER
        )
        AS
            v_count NUMBER;
        BEGIN
            SELECT COUNT(*) INTO v_count
            FROM administrators
            WHERE name = p_name AND password = p_password;

            is_valid := v_count;
        END;

    `;

    try {
        await executeQuery(procQuery, {});
        console.log("Stored Procedure 'LOGIN_ADMIN' created successfully.");
    } catch (err) {
        console.error("Error creating 'LOGIN_ADMIN':", err);
    }
}

async function initializeProcedures() {
    await createRegisterDonorProcedure();
    await createRegisterAdminProcedure();
    await createLoginDonorProcedure();
    await createLoginAdminProcedure();
}

module.exports = { initializeProcedures };
