package com.mednav.navigator;

import android.content.ContentValues;
import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

/**
 * Local SQLite store. The MVP is offline-first: the provider directory, cost
 * bands and insurance rules ship with the APK, and everything the patient does
 * (profile, bookings, chat, ratings, claims) stays on the device until a
 * backend exists to sync with.
 */
final class DbHelper extends SQLiteOpenHelper {

    static final String DB_NAME = "mednav.db";
    static final int DB_VERSION = 2;   // v2: in-house care team + consult requests

    DbHelper(Context ctx) {
        super(ctx, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onConfigure(SQLiteDatabase db) {
        db.setForeignKeyConstraintsEnabled(false);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        // ---- reference data (shipped, read-only from the app's point of view) ----
        db.execSQL("CREATE TABLE hospitals("
                + "id TEXT PRIMARY KEY, name TEXT, city TEXT, area TEXT, type TEXT,"
                + "address TEXT, phone TEXT, distance_km REAL, beds INTEGER,"
                + "cashless TEXT, rating REAL, rating_count INTEGER,"
                + "abdm INTEGER, emergency INTEGER)");

        db.execSQL("CREATE TABLE doctors("
                + "id TEXT PRIMARY KEY, name TEXT, specialty TEXT, qualification TEXT,"
                + "exp_years INTEGER, city TEXT, hospital_id TEXT, languages TEXT,"
                + "opd_fee_min INTEGER, opd_fee_max INTEGER, tele_fee INTEGER,"
                + "rating REAL, rating_count INTEGER, insurers TEXT, next_slot TEXT,"
                + "govt_scheme INTEGER, bio TEXT)");
        db.execSQL("CREATE INDEX idx_doc_search ON doctors(city, specialty)");

        db.execSQL("CREATE TABLE tests("
                + "code TEXT PRIMARY KEY, name TEXT, typical_min INTEGER,"
                + "typical_max INTEGER, fasting INTEGER, note TEXT)");

        db.execSQL("CREATE TABLE labs("
                + "id TEXT PRIMARY KEY, name TEXT, city TEXT, discount INTEGER,"
                + "home_collection INTEGER, rating REAL, phone TEXT, nabl INTEGER)");

        db.execSQL("CREATE TABLE lab_tests("
                + "lab_id TEXT, test_code TEXT, price INTEGER)");
        db.execSQL("CREATE INDEX idx_lab_tests ON lab_tests(test_code)");

        db.execSQL("CREATE TABLE insurers("
                + "id TEXT PRIMARY KEY, name TEXT, kind TEXT, tpa TEXT,"
                + "helpline TEXT, note TEXT)");

        db.execSQL("CREATE TABLE policy_clauses("
                + "insurer_id TEXT, plan TEXT, kind TEXT, heading TEXT, body TEXT)");

        db.execSQL("CREATE TABLE conditions("
                + "id TEXT PRIMARY KEY, label TEXT, specialty TEXT, tests TEXT,"
                + "red_flags TEXT, keywords TEXT)");

        db.execSQL("CREATE TABLE chat_rules("
                + "specialty TEXT, keywords TEXT, reply TEXT)");

        // The in-house care team: the service's own consultants, which is what
        // makes this a navigator rather than a directory.
        db.execSQL("CREATE TABLE consultants("
                + "id TEXT PRIMARY KEY, name TEXT, role TEXT, title TEXT,"
                + "qualification TEXT, specialty TEXT, exp_years INTEGER,"
                + "languages TEXT, hours TEXT, sla TEXT, fee_note TEXT,"
                + "rating REAL, rating_count INTEGER, helps_with TEXT, bio TEXT)");

        db.execSQL("CREATE TABLE consult_topics("
                + "id TEXT PRIMARY KEY, label TEXT, role TEXT, hint TEXT)");

        // ---- patient-generated data ----
        db.execSQL("CREATE TABLE profile(k TEXT PRIMARY KEY, v TEXT)");

        db.execSQL("CREATE TABLE bookings("
                + "id TEXT PRIMARY KEY, doctor_id TEXT, kind TEXT, slot TEXT,"
                + "status TEXT, fee INTEGER, created_ts INTEGER, reason TEXT,"
                + "rated INTEGER DEFAULT 0)");

        db.execSQL("CREATE TABLE messages("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id TEXT,"
                + "sender TEXT, body TEXT, ts INTEGER)");
        db.execSQL("CREATE INDEX idx_msg_booking ON messages(booking_id)");

        db.execSQL("CREATE TABLE ratings("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, target_kind TEXT,"
                + "target_id TEXT, stars REAL, comment TEXT, booking_id TEXT, ts INTEGER)");

        db.execSQL("CREATE TABLE records("
                + "id TEXT PRIMARY KEY, kind TEXT, title TEXT, body TEXT, ts INTEGER)");

        // A patient's requests to the care team. Threads share the messages
        // table with teleconsult bookings, keyed by this id.
        db.execSQL("CREATE TABLE consult_requests("
                + "id TEXT PRIMARY KEY, consultant_id TEXT, channel TEXT,"
                + "topic TEXT, note TEXT, preferred_time TEXT, status TEXT,"
                + "created_ts INTEGER, rated INTEGER DEFAULT 0)");

        db.execSQL("CREATE TABLE claims("
                + "id TEXT PRIMARY KEY, hospital_id TEXT, insurer_id TEXT, plan TEXT,"
                + "route TEXT, status TEXT, amount INTEGER, created_ts INTEGER, notes TEXT)");

        // Pilot funnel instrumentation (search -> booking -> consult -> rating).
        db.execSQL("CREATE TABLE events("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, props TEXT, ts INTEGER)");

        seed(db);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Reference data is disposable, patient data is not: create whatever
        // tables this version added, then re-seed reference tables only.
        if (oldVersion < 2) {
            db.execSQL("CREATE TABLE IF NOT EXISTS consultants("
                    + "id TEXT PRIMARY KEY, name TEXT, role TEXT, title TEXT,"
                    + "qualification TEXT, specialty TEXT, exp_years INTEGER,"
                    + "languages TEXT, hours TEXT, sla TEXT, fee_note TEXT,"
                    + "rating REAL, rating_count INTEGER, helps_with TEXT, bio TEXT)");
            db.execSQL("CREATE TABLE IF NOT EXISTS consult_topics("
                    + "id TEXT PRIMARY KEY, label TEXT, role TEXT, hint TEXT)");
            db.execSQL("CREATE TABLE IF NOT EXISTS consult_requests("
                    + "id TEXT PRIMARY KEY, consultant_id TEXT, channel TEXT,"
                    + "topic TEXT, note TEXT, preferred_time TEXT, status TEXT,"
                    + "created_ts INTEGER, rated INTEGER DEFAULT 0)");
        }
        reseedReference(db);
    }

    /** Drops and re-inserts only the shipped reference tables. */
    void reseedReference(SQLiteDatabase db) {
        String[] refTables = {"hospitals", "doctors", "tests", "labs", "lab_tests",
                "insurers", "policy_clauses", "conditions", "chat_rules",
                "consultants", "consult_topics"};
        for (int i = 0; i < refTables.length; i++) {
            db.execSQL("DELETE FROM " + refTables[i]);
        }
        seed(db);
    }

    private void seed(SQLiteDatabase db) {
        db.beginTransaction();
        try {
            insertRows(db, "hospitals", SeedData.HOSPITALS, new String[]{
                    "id", "name", "city", "area", "type", "address", "phone",
                    "distance_km", "beds", "cashless", "rating", "rating_count",
                    "abdm", "emergency"});

            insertRows(db, "doctors", SeedData.DOCTORS, new String[]{
                    "id", "name", "specialty", "qualification", "exp_years", "city",
                    "hospital_id", "languages", "opd_fee_min", "opd_fee_max",
                    "tele_fee", "rating", "rating_count", "insurers", "next_slot",
                    "govt_scheme", "bio"});

            insertRows(db, "tests", SeedData.TESTS, new String[]{
                    "code", "name", "typical_min", "typical_max", "fasting", "note"});

            insertRows(db, "labs", SeedData.LABS, new String[]{
                    "id", "name", "city", "discount", "home_collection", "rating",
                    "phone", "nabl"});

            insertRows(db, "lab_tests", SeedData.LAB_TESTS, new String[]{
                    "lab_id", "test_code", "price"});

            insertRows(db, "insurers", SeedData.INSURERS, new String[]{
                    "id", "name", "kind", "tpa", "helpline", "note"});

            insertRows(db, "policy_clauses", SeedData.POLICY_CLAUSES, new String[]{
                    "insurer_id", "plan", "kind", "heading", "body"});

            insertRows(db, "conditions", SeedData.CONDITIONS, new String[]{
                    "id", "label", "specialty", "tests", "red_flags", "keywords"});

            insertRows(db, "chat_rules", SeedData.CHAT_RULES, new String[]{
                    "specialty", "keywords", "reply"});

            insertRows(db, "consultants", SeedData.CONSULTANTS, new String[]{
                    "id", "name", "role", "title", "qualification", "specialty",
                    "exp_years", "languages", "hours", "sla", "fee_note",
                    "rating", "rating_count", "helps_with", "bio"});

            insertRows(db, "consult_topics", SeedData.CONSULT_TOPICS, new String[]{
                    "id", "label", "role", "hint"});

            ContentValues seedVersion = new ContentValues();
            seedVersion.put("k", "seed_version");
            seedVersion.put("v", String.valueOf(SeedData.SEED_VERSION));
            db.insertWithOnConflict("profile", null, seedVersion,
                    SQLiteDatabase.CONFLICT_REPLACE);

            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    /** Splits pipe-delimited seed rows into the given columns, in order. */
    private void insertRows(SQLiteDatabase db, String table, String[] rows, String[] cols) {
        for (int i = 0; i < rows.length; i++) {
            String[] parts = rows[i].split("\\|", -1);
            if (parts.length != cols.length) {
                throw new IllegalStateException("seed row " + i + " of " + table
                        + " has " + parts.length + " fields, expected " + cols.length);
            }
            ContentValues cv = new ContentValues();
            for (int c = 0; c < cols.length; c++) {
                cv.put(cols[c], parts[c].trim());
            }
            db.insertWithOnConflict(table, null, cv, SQLiteDatabase.CONFLICT_REPLACE);
        }
    }
}
