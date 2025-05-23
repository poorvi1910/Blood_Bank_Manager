const { executeQuery } = require('./db'); 

// --- Donor Registration Procedure ---
async function createRegisterDonorProcedure() {
    const procQuery = `
        CREATE OR REPLACE PROCEDURE REGISTER_DONOR (
            p_d_name IN Donors.D_Name%TYPE,
            p_d_phoneNo IN Donors.D_PhoneNo%TYPE,
            p_password IN Donors.Password%TYPE, -- Added password parameter
            p_d_dob IN VARCHAR2,                -- Input as String (YYYY-MM-DD)
            p_d_gender IN Donors.D_Gender%TYPE,
            p_d_bloodGroup IN Donors.D_BloodGroup%TYPE,
            p_d_address IN Donors.D_Address%TYPE,
            p_health_status IN Donors.HealthStatus%TYPE,
            p_last_donation_date IN VARCHAR2,   -- Input as String (YYYY-MM-DD) or NULL
            p_weight IN Donors.Weight%TYPE
        )
        AS
        BEGIN
            INSERT INTO Donors (
                D_Name, D_PhoneNo, Password, D_DOB, D_Gender, D_BloodGroup,
                D_Address, HealthStatus, LastDonationDate, Weight
                -- DonorID is auto-generated, DonationID defaults to NULL
            )
            VALUES (
                p_d_name, p_d_phoneNo, p_password, -- Added password
                TO_DATE(p_d_dob, 'YYYY-MM-DD'),     -- Convert DOB string to DATE
                p_d_gender, p_d_bloodGroup, p_d_address, p_health_status,
                CASE
                    WHEN p_last_donation_date IS NULL OR p_last_donation_date = '' THEN NULL
                    ELSE TO_DATE(p_last_donation_date, 'YYYY-MM-DD') -- Convert optional date string to DATE
                END,
                p_weight
            );
            COMMIT;
        END;
    `; 

    try {
        await executeQuery(procQuery, {});
        console.log("Stored Procedure 'REGISTER_DONOR' created/replaced successfully.");
    } catch (err) {
        console.error("Error creating/replacing 'REGISTER_DONOR':", err);
    }
}

// --- Admin Registration Procedure ---
async function createRegisterAdminProcedure() {
    const procQuery = `
        CREATE OR REPLACE PROCEDURE REGISTER_ADMIN (
            p_a_name IN Administrators.A_Name%TYPE,
            p_blood_bank_id IN Administrators.BloodBankID%TYPE,
            p_a_address IN Administrators.A_Address%TYPE,
            p_a_phoneNo IN Administrators.A_PhoneNo%TYPE,
            p_password IN Administrators.Password%TYPE
        )
        AS
        BEGIN
            INSERT INTO Administrators (
                A_Name, BloodBankID, A_Address, A_PhoneNo, Password
                -- AdminID is auto-generated
            )
            VALUES (
                p_a_name, p_blood_bank_id, p_a_address, p_a_phoneNo, p_password
            );
            COMMIT;
        END;
    `;

    try {
        await executeQuery(procQuery, {});
        console.log("Stored Procedure 'REGISTER_ADMIN' created/replaced successfully.");
    } catch (err) {
        console.error("Error creating/replacing 'REGISTER_ADMIN':", err);
    }
}

// --- Donor Login Procedure ---
async function createLoginDonorProcedure() {
    const procQuery = `
        CREATE OR REPLACE PROCEDURE LOGIN_DONOR(
            p_d_name IN Donors.D_Name%TYPE,
            p_password IN Donors.Password%TYPE,
            is_valid OUT NUMBER,
            p_donor_id OUT Donors.DonorID%TYPE
        )
        AS
            v_donor_id Donors.DonorID%TYPE;
        BEGIN
            SELECT DonorID INTO v_donor_id
            FROM Donors
            WHERE D_Name = p_d_name AND Password = p_password;

            is_valid := 1;
            p_donor_id := v_donor_id;

        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                is_valid := 0;
                p_donor_id := NULL;
        END;
    `;
    try {
        await executeQuery(procQuery, {});
        console.log("Stored Procedure 'LOGIN_DONOR' created/replaced successfully.");
    } catch (err) {
        console.error("Error creating/replacing 'LOGIN_DONOR':", err);
    }
}


// --- Admin Login Procedure ---
async function createLoginAdminProcedure() {
    const procQuery = `
        CREATE OR REPLACE PROCEDURE LOGIN_ADMIN(
            p_a_name IN Administrators.A_Name%TYPE,  -- Use A_Name for login
            p_password IN Administrators.Password%TYPE,
            is_valid OUT NUMBER                     -- 1 if valid, 0 otherwise
        )
        AS
            v_count NUMBER;
        BEGIN
            SELECT COUNT(*) INTO v_count
            FROM Administrators
            WHERE A_Name = p_a_name AND Password = p_password; -- Compare hashed password in real app

             IF v_count = 1 THEN
                is_valid := 1;
            ELSE
                is_valid := 0;
            END IF;
        END;
    `; 

    try {
        await executeQuery(procQuery, {});
        console.log("Stored Procedure 'LOGIN_ADMIN' created/replaced successfully.");
    } catch (err) {
        console.error("Error creating/replacing 'LOGIN_ADMIN':", err);
    }
}


async function createDonationInfoTrigger() {
    const triggerQuery = `
    CREATE OR REPLACE TRIGGER trg_delete_if_units_zero
FOR UPDATE OF UnitsDonated ON DonationInfo
COMPOUND TRIGGER
    TYPE id_list_type IS TABLE OF DonationInfo.DonationID%TYPE INDEX BY PLS_INTEGER;
    ids_to_delete id_list_type;
    idx PLS_INTEGER := 0;

    AFTER EACH ROW IS
    BEGIN
        IF :NEW.UnitsDonated = 0 THEN
            idx := idx + 1;
            ids_to_delete(idx) := :NEW.DonationID;
        END IF;
    END AFTER EACH ROW;

    AFTER STATEMENT IS
    BEGIN
        FOR i IN 1..idx LOOP
            DELETE FROM DonationInfo
            WHERE DonationID = ids_to_delete(i);
        END LOOP;
    END AFTER STATEMENT;
END trg_delete_if_units_zero;

    `;

    try {
        await executeQuery(triggerQuery, {});
        console.log("Trigger 'trg_delete_if_units_zero' created/replaced successfully.");
    } catch (err) {
        console.error("Error creating trigger 'trg_delete_if_units_zero':", err);
    }
}


async function createDonorEligibilityTrigger() {
    const triggerQuery = `
  CREATE OR REPLACE TRIGGER trg_check_donor_eligibility
BEFORE INSERT ON DonationInfo
FOR EACH ROW
DECLARE
    v_health_status VARCHAR2(20);
    v_last_donation DATE;
    v_is_eligible NUMBER := 1; -- Default to eligible
    v_reason VARCHAR2(100);
BEGIN
    -- Get donor health status and last donation date
    SELECT HealthStatus, LastDonationDate
    INTO v_health_status, v_last_donation
    FROM Donors
    WHERE DonorID = :NEW.DonorID;

    -- Check health status (should be 'Healthy')
    IF UPPER(v_health_status) != 'HEALTHY' THEN
        v_is_eligible := 0;
        v_reason := 'HealthStatus';  -- Indicating health issue
    END IF;

    -- Check last donation date (if exists)
    IF v_last_donation IS NOT NULL THEN
        IF ADD_MONTHS(v_last_donation, 2) > SYSDATE THEN
            v_is_eligible := 0;
            v_reason := 'LastDonation';  -- Indicating last donation date issue
        END IF;
    END IF;

    -- If not eligible, raise an application error to prevent insert
    IF v_is_eligible = 0 THEN
        RAISE_APPLICATION_ERROR(-20001, v_reason);
    END IF;
END;

    `;

    try {
        await executeQuery(triggerQuery, {});
        console.log("Trigger 'trg_check_donor_eligibility' created/replaced successfully.");
    } catch (err) {
        console.error("Error creating trigger 'trg_check_donor_eligibility':", err);
    }
}






// --- Function to Initialize All Procedures ---
async function initializeProcedures() {
    console.log("Initializing database procedures...");
    await createRegisterDonorProcedure();
    await createRegisterAdminProcedure();
    await createLoginDonorProcedure();
    await createLoginAdminProcedure();
    await createDonationInfoTrigger();
    await createDonorEligibilityTrigger();
    
    console.log("Database procedures initialization complete.");
}

module.exports = { initializeProcedures };