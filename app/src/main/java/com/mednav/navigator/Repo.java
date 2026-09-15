package com.mednav.navigator;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.text.TextUtils;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Every read and write the UI can perform. One class, JSON in / JSON out, so
 * the WebView layer never touches SQL and the whole data contract is reviewable
 * in one place (and is the shape a real REST backend would take in Phase-II).
 */
final class Repo {

    private final DbHelper helper;

    Repo(Context ctx) {
        this.helper = new DbHelper(ctx.getApplicationContext());
    }

    // ------------------------------------------------------------------
    // dispatch
    // ------------------------------------------------------------------

    /** Routes an operation name to its handler. Args and result are JSON. */
    JSONObject handle(String op, JSONObject a) throws JSONException {
        if ("bootstrap".equals(op)) return bootstrap();
        if ("save_profile".equals(op)) return saveProfile(a);
        if ("get_profile".equals(op)) return getProfile();
        if ("search_doctors".equals(op)) return searchDoctors(a);
        if ("doctor".equals(op)) return doctor(a.getString("id"));
        if ("hospitals".equals(op)) return hospitals(a);
        if ("labs".equals(op)) return labs(a);
        if ("estimate".equals(op)) return estimate(a);
        if ("triage".equals(op)) return triage(a);
        if ("create_booking".equals(op)) return createBooking(a);
        if ("bookings".equals(op)) return bookings();
        if ("update_booking".equals(op)) return updateBooking(a);
        if ("messages".equals(op)) return messages(a.getString("bookingId"));
        if ("send_message".equals(op)) return sendMessage(a);
        if ("rate".equals(op)) return rate(a);
        if ("insurance_check".equals(op)) return insuranceCheck(a);
        if ("policy".equals(op)) return policy(a);
        if ("save_claim".equals(op)) return saveClaim(a);
        if ("claims".equals(op)) return claims();
        if ("records".equals(op)) return records();
        if ("save_record".equals(op)) return saveRecord(a);
        if ("delete_record".equals(op)) return deleteRecord(a);
        if ("log_event".equals(op)) return logEvent(a.getString("name"), a.optString("props", ""));
        if ("metrics".equals(op)) return metrics();
        if ("reset_data".equals(op)) return resetPatientData();
        throw new IllegalArgumentException("unknown op: " + op);
    }

    // ------------------------------------------------------------------
    // bootstrap / profile
    // ------------------------------------------------------------------

    private JSONObject bootstrap() throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        JSONObject out = ok();
        out.put("profile", profileObject(db));
        out.put("cities", column(db, "SELECT DISTINCT city FROM hospitals ORDER BY city"));
        out.put("specialties", column(db,
                "SELECT DISTINCT specialty FROM doctors ORDER BY specialty"));
        out.put("insurers", rows(db, "SELECT * FROM insurers ORDER BY kind DESC, name"));
        out.put("conditions", rows(db,
                "SELECT id, label, specialty, tests, red_flags FROM conditions ORDER BY label"));
        out.put("tests", rows(db, "SELECT * FROM tests ORDER BY name"));
        out.put("seedVersion", SeedData.SEED_VERSION);
        return out;
    }

    private JSONObject saveProfile(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        String[] keys = {"name", "phone", "age", "sex", "city", "conditions",
                "insurer_id", "plan", "abha", "lang", "onboarded"};
        db.beginTransaction();
        try {
            for (int i = 0; i < keys.length; i++) {
                if (!a.has(keys[i])) continue;
                ContentValues cv = new ContentValues();
                cv.put("k", keys[i]);
                cv.put("v", a.optString(keys[i], ""));
                db.insertWithOnConflict("profile", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        JSONObject out = ok();
        out.put("profile", profileObject(db));
        return out;
    }

    private JSONObject getProfile() throws JSONException {
        JSONObject out = ok();
        out.put("profile", profileObject(helper.getReadableDatabase()));
        return out;
    }

    private JSONObject profileObject(SQLiteDatabase db) throws JSONException {
        JSONObject p = new JSONObject();
        Cursor c = db.rawQuery("SELECT k, v FROM profile", null);
        try {
            while (c.moveToNext()) p.put(c.getString(0), c.getString(1));
        } finally {
            c.close();
        }
        return p;
    }

    // ------------------------------------------------------------------
    // doctor / hospital search
    // ------------------------------------------------------------------

    /**
     * The core search: specialty + city + affordability + whether the doctor's
     * hospital actually settles the patient's insurer. Ranking is a blend of
     * rating and fee so the cheapest trustworthy option surfaces, which is the
     * MVP's central value hypothesis.
     */
    private JSONObject searchDoctors(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        StringBuilder sql = new StringBuilder(
                "SELECT d.*, h.name AS hospital_name, h.city AS hospital_city, h.area, "
              + "h.type AS hospital_type, h.distance_km, h.cashless, h.emergency, "
              + "h.rating AS hospital_rating, h.abdm, h.phone AS hospital_phone "
              + "FROM doctors d LEFT JOIN hospitals h ON h.id = d.hospital_id WHERE 1=1");
        List<String> args = new ArrayList<String>();

        String specialty = a.optString("specialty", "");
        if (!TextUtils.isEmpty(specialty)) {
            sql.append(" AND d.specialty = ?");
            args.add(specialty);
        }
        String city = a.optString("city", "");
        if (!TextUtils.isEmpty(city)) {
            sql.append(" AND d.city = ?");
            args.add(city);
        }
        String q = a.optString("q", "").trim();
        if (!TextUtils.isEmpty(q)) {
            sql.append(" AND (d.name LIKE ? OR d.specialty LIKE ? OR h.name LIKE ?"
                    + " OR d.qualification LIKE ? OR d.languages LIKE ?)");
            String like = "%" + q + "%";
            for (int i = 0; i < 5; i++) args.add(like);
        }
        int maxFee = a.optInt("maxFee", 0);
        if (maxFee > 0) {
            sql.append(" AND d.opd_fee_min <= ?");
            args.add(String.valueOf(maxFee));
        }
        String insurerId = a.optString("insurerId", "");
        if (!TextUtils.isEmpty(insurerId)) {
            // Cashless only counts when the hospital settles it, not just the doctor.
            sql.append(" AND (',' || d.insurers || ',' LIKE ?)"
                    + " AND (',' || IFNULL(h.cashless,'') || ',' LIKE ?)");
            args.add("%," + insurerId + ",%");
            args.add("%," + insurerId + ",%");
        }
        if (a.optBoolean("teleOnly", false)) sql.append(" AND d.tele_fee > 0");
        if (a.optBoolean("govtSchemeOnly", false)) sql.append(" AND d.govt_scheme = 1");
        double minRating = a.optDouble("minRating", 0);
        if (minRating > 0) {
            sql.append(" AND d.rating >= ?");
            args.add(String.valueOf(minRating));
        }
        double maxDistance = a.optDouble("maxDistance", 0);
        if (maxDistance > 0) {
            sql.append(" AND IFNULL(h.distance_km, 0) <= ?");
            args.add(String.valueOf(maxDistance));
        }

        String sort = a.optString("sort", "value");
        if ("fee".equals(sort)) {
            sql.append(" ORDER BY d.opd_fee_min ASC, d.rating DESC");
        } else if ("rating".equals(sort)) {
            sql.append(" ORDER BY d.rating DESC, d.rating_count DESC");
        } else if ("distance".equals(sort)) {
            sql.append(" ORDER BY IFNULL(h.distance_km, 999) ASC, d.rating DESC");
        } else if ("experience".equals(sort)) {
            sql.append(" ORDER BY d.exp_years DESC, d.rating DESC");
        } else {
            // "value": high rating per rupee, with a small confidence nudge for
            // doctors who have actually been rated by more patients.
            sql.append(" ORDER BY (d.rating * 220.0 + MIN(d.rating_count, 300) * 0.35)"
                    + " / (d.opd_fee_min + 120.0) DESC");
        }
        sql.append(" LIMIT 60");

        JSONArray list = rows(db, sql.toString(), args.toArray(new String[args.size()]));
        for (int i = 0; i < list.length(); i++) {
            decorateDoctor(list.getJSONObject(i), insurerId);
        }
        JSONObject out = ok();
        out.put("doctors", list);
        out.put("count", list.length());
        return out;
    }

    private JSONObject doctor(String id) throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        JSONArray found = rows(db,
                "SELECT d.*, h.name AS hospital_name, h.city AS hospital_city, h.area,"
              + " h.type AS hospital_type, h.address, h.distance_km, h.cashless,"
              + " h.emergency, h.beds, h.abdm, h.rating AS hospital_rating,"
              + " h.phone AS hospital_phone FROM doctors d"
              + " LEFT JOIN hospitals h ON h.id = d.hospital_id WHERE d.id = ?",
                new String[]{id});
        if (found.length() == 0) throw new IllegalArgumentException("no such doctor: " + id);

        JSONObject d = found.getJSONObject(0);
        String insurerId = profileValue(db, "insurer_id");
        decorateDoctor(d, insurerId);

        // Tests a doctor of this specialty commonly advises, from the rule table.
        JSONArray testCodes = new JSONArray();
        Cursor c = db.rawQuery(
                "SELECT tests FROM conditions WHERE specialty = ? LIMIT 3",
                new String[]{d.optString("specialty")});
        try {
            while (c.moveToNext()) {
                String[] codes = c.getString(0).split(",");
                for (int i = 0; i < codes.length; i++) {
                    if (!contains(testCodes, codes[i])) testCodes.put(codes[i].trim());
                }
            }
        } finally {
            c.close();
        }
        d.put("commonTests", testDetails(db, testCodes, d.optString("city")));
        d.put("reviews", rows(db,
                "SELECT stars, comment, ts FROM ratings WHERE target_kind='doctor'"
              + " AND target_id = ? ORDER BY ts DESC LIMIT 10", new String[]{id}));

        JSONObject out = ok();
        out.put("doctor", d);
        return out;
    }

    /** Adds fee band text, cashless status for the patient's insurer, and tags. */
    private void decorateDoctor(JSONObject d, String insurerId) throws JSONException {
        int feeMin = d.optInt("opd_fee_min");
        int feeMax = d.optInt("opd_fee_max");
        d.put("feeBand", feeMin == feeMax ? ("Rs " + feeMin) : ("Rs " + feeMin + "-" + feeMax));
        d.put("teleAvailable", d.optInt("tele_fee") > 0);

        boolean doctorTakesIt = !TextUtils.isEmpty(insurerId)
                && csvContains(d.optString("insurers"), insurerId);
        boolean hospitalTakesIt = !TextUtils.isEmpty(insurerId)
                && csvContains(d.optString("cashless"), insurerId);
        d.put("cashlessForYou", doctorTakesIt && hospitalTakesIt);
        d.put("insuranceNote", TextUtils.isEmpty(insurerId)
                ? "Add your insurance in Profile to see cashless options"
                : (doctorTakesIt && hospitalTakesIt
                    ? "Cashless possible with pre-authorisation"
                    : "Likely reimbursement only - confirm at the hospital desk"));
        d.put("sample", true); // the pilot dataset is illustrative, never a real listing
    }

    private JSONObject hospitals(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        StringBuilder sql = new StringBuilder("SELECT * FROM hospitals WHERE 1=1");
        List<String> args = new ArrayList<String>();
        String city = a.optString("city", "");
        if (!TextUtils.isEmpty(city)) {
            sql.append(" AND city = ?");
            args.add(city);
        }
        String insurerId = a.optString("insurerId", "");
        if (!TextUtils.isEmpty(insurerId)) {
            sql.append(" AND (',' || cashless || ',' LIKE ?)");
            args.add("%," + insurerId + ",%");
        }
        if (a.optBoolean("emergencyOnly", false)) sql.append(" AND emergency = 1");
        double maxDistance = a.optDouble("maxDistance", 0);
        if (maxDistance > 0) {
            sql.append(" AND distance_km <= ?");
            args.add(String.valueOf(maxDistance));
        }
        sql.append(" ORDER BY distance_km ASC");

        JSONArray list = rows(db, sql.toString(), args.toArray(new String[args.size()]));
        for (int i = 0; i < list.length(); i++) {
            JSONObject h = list.getJSONObject(i);
            h.put("cashlessForYou", !TextUtils.isEmpty(insurerId)
                    && csvContains(h.optString("cashless"), insurerId));
            h.put("insurerNames", insurerNames(db, h.optString("cashless")));
            h.put("doctorCount", scalar(db,
                    "SELECT COUNT(*) FROM doctors WHERE hospital_id = ?",
                    new String[]{h.optString("id")}));
            h.put("sample", true);
        }
        JSONObject out = ok();
        out.put("hospitals", list);
        return out;
    }

    // ------------------------------------------------------------------
    // cost guidance
    // ------------------------------------------------------------------

    private JSONObject labs(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        String city = a.optString("city", "");
        JSONArray wanted = a.optJSONArray("tests");
        JSONArray list = TextUtils.isEmpty(city)
                ? rows(db, "SELECT * FROM labs ORDER BY city, rating DESC")
                : rows(db, "SELECT * FROM labs WHERE city = ? ORDER BY rating DESC",
                        new String[]{city});

        for (int i = 0; i < list.length(); i++) {
            JSONObject lab = list.getJSONObject(i);
            JSONArray priced = new JSONArray();
            int total = 0;
            int missing = 0;
            if (wanted != null) {
                for (int t = 0; t < wanted.length(); t++) {
                    String code = wanted.getString(t);
                    long price = scalar(db,
                            "SELECT price FROM lab_tests WHERE lab_id = ? AND test_code = ?",
                            new String[]{lab.optString("id"), code});
                    JSONObject row = new JSONObject();
                    row.put("code", code);
                    row.put("name", testName(db, code));
                    if (price > 0) {
                        row.put("price", price);
                        total += price;
                    } else {
                        row.put("price", JSONObject.NULL);
                        missing++;
                    }
                    priced.put(row);
                }
            }
            lab.put("tests", priced);
            lab.put("total", total);
            lab.put("missing", missing);
            lab.put("sample", true);
        }
        JSONObject out = ok();
        out.put("labs", list);
        return out;
    }

    /**
     * The "what will this actually cost me" screen: OPD fee band plus the test
     * set, showing both the usual city band and the cheapest partner-lab price.
     */
    private JSONObject estimate(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        String city = a.optString("city", "");
        JSONArray codes = a.optJSONArray("tests");
        if (codes == null) codes = new JSONArray();

        int opdMin = 0, opdMax = 0;
        JSONObject doc = null;
        String doctorId = a.optString("doctorId", "");
        if (!TextUtils.isEmpty(doctorId)) {
            JSONArray found = rows(db,
                    "SELECT id, name, specialty, opd_fee_min, opd_fee_max, tele_fee, city"
                  + " FROM doctors WHERE id = ?", new String[]{doctorId});
            if (found.length() > 0) {
                doc = found.getJSONObject(0);
                opdMin = doc.optInt("opd_fee_min");
                opdMax = doc.optInt("opd_fee_max");
                if (TextUtils.isEmpty(city)) city = doc.optString("city");
            }
        }

        JSONArray testRows = testDetails(db, codes, city);
        int typicalMin = 0, typicalMax = 0, bestTotal = 0;
        for (int i = 0; i < testRows.length(); i++) {
            JSONObject t = testRows.getJSONObject(i);
            typicalMin += t.optInt("typical_min");
            typicalMax += t.optInt("typical_max");
            bestTotal += t.optInt("bestPrice", t.optInt("typical_max"));
        }

        JSONObject out = ok();
        out.put("doctor", doc == null ? JSONObject.NULL : doc);
        out.put("city", city);
        out.put("tests", testRows);
        out.put("opdMin", opdMin);
        out.put("opdMax", opdMax);
        out.put("testsTypicalMin", typicalMin);
        out.put("testsTypicalMax", typicalMax);
        out.put("testsBestTotal", bestTotal);
        // The floor is what we can actually point the patient to (the cheapest
        // partner lab), not the theoretical bottom of the city band - quoting a
        // number nobody can obtain would be the wrong kind of helpful.
        out.put("totalMin", opdMin + bestTotal);
        out.put("totalMax", opdMax + typicalMax);
        out.put("savings", Math.max(0, typicalMax - bestTotal));
        out.put("labs", labs(jsonOf("city", city, "tests", codes)).optJSONArray("labs"));
        return out;
    }

    /** Joins test metadata with the cheapest partner-lab price in the city. */
    private JSONArray testDetails(SQLiteDatabase db, JSONArray codes, String city)
            throws JSONException {
        JSONArray out = new JSONArray();
        for (int i = 0; i < codes.length(); i++) {
            String code = codes.getString(i).trim();
            if (TextUtils.isEmpty(code)) continue;
            JSONArray found = rows(db, "SELECT * FROM tests WHERE code = ?",
                    new String[]{code});
            JSONObject t = found.length() > 0 ? found.getJSONObject(0) : new JSONObject();
            if (found.length() == 0) {
                t.put("code", code);
                t.put("name", code);
                t.put("typical_min", 0);
                t.put("typical_max", 0);
            }
            Cursor c = TextUtils.isEmpty(city)
                    ? db.rawQuery("SELECT l.name, lt.price FROM lab_tests lt"
                        + " JOIN labs l ON l.id = lt.lab_id WHERE lt.test_code = ?"
                        + " ORDER BY lt.price ASC LIMIT 1", new String[]{code})
                    : db.rawQuery("SELECT l.name, lt.price FROM lab_tests lt"
                        + " JOIN labs l ON l.id = lt.lab_id WHERE lt.test_code = ?"
                        + " AND l.city = ? ORDER BY lt.price ASC LIMIT 1",
                        new String[]{code, city});
            try {
                if (c.moveToNext()) {
                    t.put("bestLab", c.getString(0));
                    t.put("bestPrice", c.getInt(1));
                }
            } finally {
                c.close();
            }
            out.put(t);
        }
        return out;
    }

    // ------------------------------------------------------------------
    // triage (rule-based, deliberately not AI in the MVP)
    // ------------------------------------------------------------------

    private JSONObject triage(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        String text = a.optString("text", "").toLowerCase(Locale.ENGLISH);
        JSONArray all = rows(db, "SELECT * FROM conditions");
        JSONArray matches = new JSONArray();
        for (int i = 0; i < all.length(); i++) {
            JSONObject cond = all.getJSONObject(i);
            int score = 0;
            String[] keywords = cond.optString("keywords").split(",");
            for (int k = 0; k < keywords.length; k++) {
                String kw = keywords[k].trim().toLowerCase(Locale.ENGLISH);
                if (kw.length() > 1 && text.contains(kw)) score += kw.length();
            }
            if (cond.optString("label").toLowerCase(Locale.ENGLISH).contains(text)
                    && text.length() > 2) {
                score += 5;
            }
            if (score > 0) {
                cond.put("score", score);
                cond.put("testDetails", testDetails(db,
                        csvToArray(cond.optString("tests")), profileValue(db, "city")));
                matches.put(cond);
            }
        }
        // simple insertion sort by score, highest first
        for (int i = 1; i < matches.length(); i++) {
            for (int j = i; j > 0; j--) {
                if (matches.getJSONObject(j).optInt("score")
                        > matches.getJSONObject(j - 1).optInt("score")) {
                    JSONObject tmp = matches.getJSONObject(j);
                    matches.put(j, matches.getJSONObject(j - 1));
                    matches.put(j - 1, tmp);
                } else {
                    break;
                }
            }
        }
        JSONObject out = ok();
        out.put("matches", matches);
        out.put("query", a.optString("text", ""));
        return out;
    }

    // ------------------------------------------------------------------
    // bookings, chat, ratings
    // ------------------------------------------------------------------

    private JSONObject createBooking(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        String doctorId = a.getString("doctorId");
        String kind = a.optString("kind", "tele");   // tele | opd
        JSONArray found = rows(db,
                "SELECT opd_fee_min, tele_fee, name, specialty FROM doctors WHERE id = ?",
                new String[]{doctorId});
        if (found.length() == 0) throw new IllegalArgumentException("no such doctor");
        JSONObject d = found.getJSONObject(0);

        String id = "bk_" + System.currentTimeMillis();
        ContentValues cv = new ContentValues();
        cv.put("id", id);
        cv.put("doctor_id", doctorId);
        cv.put("kind", kind);
        cv.put("slot", a.optString("slot", ""));
        cv.put("status", "confirmed");
        cv.put("fee", "tele".equals(kind) ? d.optInt("tele_fee") : d.optInt("opd_fee_min"));
        cv.put("created_ts", System.currentTimeMillis());
        cv.put("reason", a.optString("reason", ""));
        db.insert("bookings", null, cv);

        if ("tele".equals(kind)) {
            insertMessage(db, id, "doctor", "Namaskar, I am " + d.optString("name")
                    + " (" + d.optString("specialty") + "). The first 10 minutes of this"
                    + " chat are free. Please tell me what is troubling you, since when,"
                    + " and share any recent test reports.");
        }
        event(db, "booking_created", "kind=" + kind + ";doctor=" + doctorId);

        JSONObject out = ok();
        out.put("bookingId", id);
        out.put("bookings", bookings().optJSONArray("bookings"));
        return out;
    }

    private JSONObject bookings() throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        JSONArray list = rows(db,
                "SELECT b.*, d.name AS doctor_name, d.specialty, d.tele_fee,"
              + " h.name AS hospital_name, h.address, h.phone AS hospital_phone,"
              + " h.city AS hospital_city FROM bookings b"
              + " LEFT JOIN doctors d ON d.id = b.doctor_id"
              + " LEFT JOIN hospitals h ON h.id = d.hospital_id"
              + " ORDER BY b.created_ts DESC");
        for (int i = 0; i < list.length(); i++) {
            JSONObject b = list.getJSONObject(i);
            b.put("messageCount", scalar(db,
                    "SELECT COUNT(*) FROM messages WHERE booking_id = ?",
                    new String[]{b.optString("id")}));
        }
        JSONObject out = ok();
        out.put("bookings", list);
        return out;
    }

    private JSONObject updateBooking(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("status", a.getString("status"));
        db.update("bookings", cv, "id = ?", new String[]{a.getString("id")});
        event(db, "booking_" + a.getString("status"), a.getString("id"));
        return bookings();
    }

    private JSONObject messages(String bookingId) throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        JSONObject out = ok();
        out.put("messages", rows(db,
                "SELECT * FROM messages WHERE booking_id = ? ORDER BY id ASC",
                new String[]{bookingId}));
        return out;
    }

    /**
     * Stores the patient's message and answers with the best matching canned
     * reply for that specialty. A real deployment routes this to the doctor;
     * the rule table keeps the pilot usable (and honest) with no clinician online.
     */
    private JSONObject sendMessage(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        String bookingId = a.getString("bookingId");
        String body = a.getString("body");
        insertMessage(db, bookingId, "patient", body);

        String specialty = "";
        Cursor c = db.rawQuery("SELECT d.specialty FROM bookings b"
                + " JOIN doctors d ON d.id = b.doctor_id WHERE b.id = ?",
                new String[]{bookingId});
        try {
            if (c.moveToNext()) specialty = c.getString(0);
        } finally {
            c.close();
        }

        String reply = matchReply(db, specialty, body.toLowerCase(Locale.ENGLISH));
        insertMessage(db, bookingId, "doctor", reply);
        event(db, "tele_message", "booking=" + bookingId);
        return messages(bookingId);
    }

    private String matchReply(SQLiteDatabase db, String specialty, String lower) {
        String best = null;
        int bestScore = 0;
        Cursor c = db.rawQuery("SELECT specialty, keywords, reply FROM chat_rules", null);
        try {
            while (c.moveToNext()) {
                String ruleSpecialty = c.getString(0);
                if (!"*".equals(ruleSpecialty) && !ruleSpecialty.equals(specialty)) continue;
                String[] keywords = c.getString(1).split(",");
                int score = 0;
                for (int i = 0; i < keywords.length; i++) {
                    String kw = keywords[i].trim().toLowerCase(Locale.ENGLISH);
                    if (kw.length() > 1 && lower.contains(kw)) {
                        // a specialty-specific rule outranks a generic one
                        score += kw.length() + ("*".equals(ruleSpecialty) ? 0 : 6);
                    }
                }
                if (score > bestScore) {
                    bestScore = score;
                    best = c.getString(2);
                }
            }
        } finally {
            c.close();
        }
        if (best != null) return best;
        return "Thank you, noted. Please also tell me since when this has been going on,"
                + " what medicines you are already taking, and whether you have diabetes"
                + " or high blood pressure. If you have recent reports, list the values here.";
    }

    private void insertMessage(SQLiteDatabase db, String bookingId, String sender, String body) {
        ContentValues cv = new ContentValues();
        cv.put("booking_id", bookingId);
        cv.put("sender", sender);
        cv.put("body", body);
        cv.put("ts", System.currentTimeMillis());
        db.insert("messages", null, cv);
    }

    /**
     * Records a rating and folds it straight into the provider's aggregate, so
     * one patient's feedback changes what the next patient in that city sees.
     */
    private JSONObject rate(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        String kind = a.getString("targetKind");   // doctor | hospital | insurance
        String targetId = a.optString("targetId", "");
        double stars = a.getDouble("stars");

        ContentValues cv = new ContentValues();
        cv.put("target_kind", kind);
        cv.put("target_id", targetId);
        cv.put("stars", stars);
        cv.put("comment", a.optString("comment", ""));
        cv.put("booking_id", a.optString("bookingId", ""));
        cv.put("ts", System.currentTimeMillis());
        db.insert("ratings", null, cv);

        String table = "doctor".equals(kind) ? "doctors" : ("hospital".equals(kind) ? "hospitals" : null);
        if (table != null && !TextUtils.isEmpty(targetId)) {
            Cursor c = db.rawQuery("SELECT rating, rating_count FROM " + table + " WHERE id = ?",
                    new String[]{targetId});
            try {
                if (c.moveToNext()) {
                    double rating = c.getDouble(0);
                    int count = c.getInt(1);
                    int newCount = count + 1;
                    double newRating = ((rating * count) + stars) / newCount;
                    ContentValues agg = new ContentValues();
                    agg.put("rating", Math.round(newRating * 10) / 10.0);
                    agg.put("rating_count", newCount);
                    db.update(table, agg, "id = ?", new String[]{targetId});
                }
            } finally {
                c.close();
            }
        }
        String bookingId = a.optString("bookingId", "");
        if (!TextUtils.isEmpty(bookingId)) {
            ContentValues done = new ContentValues();
            done.put("rated", 1);
            db.update("bookings", done, "id = ?", new String[]{bookingId});
        }
        event(db, "rating_submitted", kind + "=" + targetId + ";stars=" + stars);
        return ok();
    }

    // ------------------------------------------------------------------
    // insurance
    // ------------------------------------------------------------------

    /**
     * Answers the question patients actually ask before leaving home: is this
     * hospital in my network, what do I carry, and what do I say at the desk.
     */
    private JSONObject insuranceCheck(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        String insurerId = a.optString("insurerId", profileValue(db, "insurer_id"));
        String hospitalId = a.optString("hospitalId", "");
        String plan = a.optString("plan", profileValue(db, "plan"));

        JSONObject out = ok();
        JSONArray insurer = rows(db, "SELECT * FROM insurers WHERE id = ?",
                new String[]{insurerId});
        out.put("insurer", insurer.length() > 0 ? insurer.getJSONObject(0) : JSONObject.NULL);

        boolean network = false;
        JSONObject hospital = null;
        if (!TextUtils.isEmpty(hospitalId)) {
            JSONArray found = rows(db, "SELECT * FROM hospitals WHERE id = ?",
                    new String[]{hospitalId});
            if (found.length() > 0) {
                hospital = found.getJSONObject(0);
                network = csvContains(hospital.optString("cashless"), insurerId);
                hospital.put("insurerNames", insurerNames(db, hospital.optString("cashless")));
            }
        }
        out.put("hospital", hospital == null ? JSONObject.NULL : hospital);
        out.put("network", network);
        out.put("route", network ? "cashless" : "reimbursement");

        boolean isScheme = insurer.length() > 0
                && "scheme".equals(insurer.getJSONObject(0).optString("kind"));

        JSONArray steps = new JSONArray();
        if (network) {
            steps.put(step("1", "Confirm the hospital is still empanelled",
                    "Network lists change. Ask the insurance desk to confirm your insurer"
                  + " is live today before admission."));
            steps.put(step("2", isScheme ? "Go to the scheme help desk"
                            : "Ask for cashless pre-authorisation",
                    isScheme ? "Show your scheme card at the help desk; the hospital raises"
                            + " the pre-authorisation on the state portal."
                            : "The hospital fills the pre-auth form and sends it to the TPA:"
                            + " at least 48 hours before a planned admission, within 24 hours"
                            + " for an emergency."));
            steps.put(step("3", "Get the approval in writing",
                    "Ask for the approved amount and what is excluded. Non-medical"
                  + " consumables and room upgrades are usually your own cost."));
            steps.put(step("4", "Check the final bill line by line",
                    "Compare the discharge bill against the approved amount. Query any"
                  + " item you did not consent to."));
        } else {
            steps.put(step("1", "This hospital is not in your cashless network",
                    "You can still be treated here, but you will likely pay first and"
                  + " claim later. Check the network list for a nearby alternative."));
            steps.put(step("2", "Inform the insurer within 24 hours",
                    "Call the helpline or use the insurer app to intimate the admission."
                  + " Late intimation is a common reason for a reduced claim."));
            steps.put(step("3", "Collect every original document",
                    "Discharge summary, itemised bills, payment receipts, investigation"
                  + " reports and the doctor's prescriptions."));
            steps.put(step("4", "File within the claim window",
                    "Most policies require submission within 30 days of discharge."));
        }
        out.put("steps", steps);

        JSONArray checklist = new JSONArray();
        checklist.put("Insurance card or policy number");
        checklist.put(isScheme ? "Scheme smart card (and ration card)" : "Photo ID (Aadhaar / voter ID)");
        checklist.put("ABHA / health ID if you have one");
        checklist.put("Doctor's admission advice letter");
        checklist.put("Past reports and discharge summaries");
        checklist.put("A list of your current medicines");
        if (!network) checklist.put("Enough money or a card for the deposit");
        out.put("checklist", checklist);

        out.put("clauses", rows(db,
                "SELECT * FROM policy_clauses WHERE insurer_id = ?"
              + (TextUtils.isEmpty(plan) ? "" : " AND plan = ?")
              + " ORDER BY CASE kind WHEN 'covered' THEN 1 WHEN 'limit' THEN 2"
              + " WHEN 'waiting' THEN 3 WHEN 'excluded' THEN 4 ELSE 5 END",
                TextUtils.isEmpty(plan) ? new String[]{insurerId}
                        : new String[]{insurerId, plan}));

        out.put("networkHospitals", hospitals(jsonOf("insurerId", insurerId,
                "city", a.optString("city", profileValue(db, "city")))).optJSONArray("hospitals"));
        event(helper.getWritableDatabase(), "insurance_check",
                "insurer=" + insurerId + ";network=" + network);
        return out;
    }

    private JSONObject policy(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        String insurerId = a.optString("insurerId", profileValue(db, "insurer_id"));
        JSONObject out = ok();
        out.put("plans", column(db,
                "SELECT DISTINCT plan FROM policy_clauses WHERE insurer_id = ?",
                new String[]{insurerId}));
        out.put("clauses", rows(db,
                "SELECT * FROM policy_clauses WHERE insurer_id = ? ORDER BY plan, kind",
                new String[]{insurerId}));
        return out;
    }

    private JSONObject saveClaim(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        String id = a.optString("id", "");
        if (TextUtils.isEmpty(id)) id = "cl_" + System.currentTimeMillis();
        ContentValues cv = new ContentValues();
        cv.put("id", id);
        cv.put("hospital_id", a.optString("hospitalId", ""));
        cv.put("insurer_id", a.optString("insurerId", ""));
        cv.put("plan", a.optString("plan", ""));
        cv.put("route", a.optString("route", ""));
        cv.put("status", a.optString("status", "started"));
        cv.put("amount", a.optInt("amount", 0));
        cv.put("created_ts", System.currentTimeMillis());
        cv.put("notes", a.optString("notes", ""));
        db.insertWithOnConflict("claims", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
        event(db, "claim_tracked", a.optString("route", ""));
        return claims();
    }

    private JSONObject claims() throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        JSONObject out = ok();
        out.put("claims", rows(db,
                "SELECT c.*, h.name AS hospital_name, i.name AS insurer_name,"
              + " i.helpline FROM claims c"
              + " LEFT JOIN hospitals h ON h.id = c.hospital_id"
              + " LEFT JOIN insurers i ON i.id = c.insurer_id"
              + " ORDER BY c.created_ts DESC"));
        return out;
    }

    // ------------------------------------------------------------------
    // records, metrics, reset
    // ------------------------------------------------------------------

    private JSONObject records() throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        JSONObject out = ok();
        out.put("records", rows(db, "SELECT * FROM records ORDER BY ts DESC"));
        return out;
    }

    private JSONObject saveRecord(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        String id = a.optString("id", "");
        if (TextUtils.isEmpty(id)) id = "rec_" + System.currentTimeMillis();
        ContentValues cv = new ContentValues();
        cv.put("id", id);
        cv.put("kind", a.optString("kind", "note"));
        cv.put("title", a.optString("title", ""));
        cv.put("body", a.optString("body", ""));
        cv.put("ts", System.currentTimeMillis());
        db.insertWithOnConflict("records", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
        event(db, "record_saved", a.optString("kind", "note"));
        return records();
    }

    private JSONObject deleteRecord(JSONObject a) throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        db.delete("records", "id = ?", new String[]{a.getString("id")});
        return records();
    }

    private JSONObject logEvent(String name, String props) throws JSONException {
        event(helper.getWritableDatabase(), name, props);
        return ok();
    }

    private void event(SQLiteDatabase db, String name, String props) {
        ContentValues cv = new ContentValues();
        cv.put("name", name);
        cv.put("props", props);
        cv.put("ts", System.currentTimeMillis());
        db.insert("events", null, cv);
    }

    /** The pilot funnel from the blueprint: search -> booking -> consult -> rating. */
    private JSONObject metrics() throws JSONException {
        SQLiteDatabase db = helper.getReadableDatabase();
        JSONObject out = ok();
        JSONObject funnel = new JSONObject();
        funnel.put("searches", scalar(db, "SELECT COUNT(*) FROM events WHERE name='search'", null));
        funnel.put("doctorViews", scalar(db, "SELECT COUNT(*) FROM events WHERE name='doctor_view'", null));
        funnel.put("bookings", scalar(db, "SELECT COUNT(*) FROM bookings", null));
        funnel.put("teleMessages", scalar(db, "SELECT COUNT(*) FROM messages WHERE sender='patient'", null));
        funnel.put("completed", scalar(db, "SELECT COUNT(*) FROM bookings WHERE status='completed'", null));
        funnel.put("ratings", scalar(db, "SELECT COUNT(*) FROM ratings", null));
        funnel.put("insuranceChecks", scalar(db, "SELECT COUNT(*) FROM events WHERE name='insurance_check'", null));
        out.put("funnel", funnel);
        out.put("byDay", rows(db,
                "SELECT date(ts/1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS n"
              + " FROM events GROUP BY day ORDER BY day DESC LIMIT 14"));
        out.put("recent", rows(db,
                "SELECT name, props, ts FROM events ORDER BY id DESC LIMIT 30"));
        out.put("firstSeen", scalar(db, "SELECT MIN(ts) FROM events", null));
        return out;
    }

    private JSONObject resetPatientData() throws JSONException {
        SQLiteDatabase db = helper.getWritableDatabase();
        String[] tables = {"profile", "bookings", "messages", "ratings",
                "records", "claims", "events"};
        db.beginTransaction();
        try {
            for (int i = 0; i < tables.length; i++) db.execSQL("DELETE FROM " + tables[i]);
            helper.reseedReference(db);
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return ok();
    }

    // ------------------------------------------------------------------
    // small helpers
    // ------------------------------------------------------------------

    private JSONObject step(String n, String title, String detail) throws JSONException {
        JSONObject o = new JSONObject();
        o.put("n", n);
        o.put("title", title);
        o.put("detail", detail);
        return o;
    }

    private JSONObject ok() throws JSONException {
        JSONObject o = new JSONObject();
        o.put("ok", true);
        return o;
    }

    private JSONObject jsonOf(String k1, Object v1, String k2, Object v2) throws JSONException {
        JSONObject o = new JSONObject();
        o.put(k1, v1);
        o.put(k2, v2);
        return o;
    }

    /** Runs a query and returns every row as a JSON object keyed by column name. */
    private JSONArray rows(SQLiteDatabase db, String sql) throws JSONException {
        return rows(db, sql, null);
    }

    private JSONArray rows(SQLiteDatabase db, String sql, String[] args) throws JSONException {
        JSONArray out = new JSONArray();
        Cursor c = db.rawQuery(sql, args);
        try {
            String[] cols = c.getColumnNames();
            while (c.moveToNext()) {
                JSONObject row = new JSONObject();
                for (int i = 0; i < cols.length; i++) {
                    switch (c.getType(i)) {
                        case Cursor.FIELD_TYPE_NULL:
                            row.put(cols[i], JSONObject.NULL);
                            break;
                        case Cursor.FIELD_TYPE_INTEGER:
                            row.put(cols[i], c.getLong(i));
                            break;
                        case Cursor.FIELD_TYPE_FLOAT:
                            row.put(cols[i], c.getDouble(i));
                            break;
                        default:
                            row.put(cols[i], c.getString(i));
                    }
                }
                out.put(row);
            }
        } finally {
            c.close();
        }
        return out;
    }

    private JSONArray column(SQLiteDatabase db, String sql) {
        return column(db, sql, null);
    }

    private JSONArray column(SQLiteDatabase db, String sql, String[] args) {
        JSONArray out = new JSONArray();
        Cursor c = db.rawQuery(sql, args);
        try {
            while (c.moveToNext()) out.put(c.getString(0));
        } finally {
            c.close();
        }
        return out;
    }

    private long scalar(SQLiteDatabase db, String sql, String[] args) {
        Cursor c = db.rawQuery(sql, args);
        try {
            return c.moveToNext() ? c.getLong(0) : 0L;
        } finally {
            c.close();
        }
    }

    private String testName(SQLiteDatabase db, String code) {
        Cursor c = db.rawQuery("SELECT name FROM tests WHERE code = ?", new String[]{code});
        try {
            return c.moveToNext() ? c.getString(0) : code;
        } finally {
            c.close();
        }
    }

    private String profileValue(SQLiteDatabase db, String key) {
        Cursor c = db.rawQuery("SELECT v FROM profile WHERE k = ?", new String[]{key});
        try {
            return c.moveToNext() ? c.getString(0) : "";
        } finally {
            c.close();
        }
    }

    private JSONArray insurerNames(SQLiteDatabase db, String csv) {
        JSONArray out = new JSONArray();
        if (TextUtils.isEmpty(csv)) return out;
        String[] ids = csv.split(",");
        for (int i = 0; i < ids.length; i++) {
            Cursor c = db.rawQuery("SELECT name FROM insurers WHERE id = ?",
                    new String[]{ids[i].trim()});
            try {
                if (c.moveToNext()) out.put(c.getString(0));
            } finally {
                c.close();
            }
        }
        return out;
    }

    private static JSONArray csvToArray(String csv) {
        JSONArray out = new JSONArray();
        if (TextUtils.isEmpty(csv)) return out;
        String[] parts = csv.split(",");
        for (int i = 0; i < parts.length; i++) {
            String p = parts[i].trim();
            if (p.length() > 0) out.put(p);
        }
        return out;
    }

    private static boolean csvContains(String csv, String value) {
        if (TextUtils.isEmpty(csv) || TextUtils.isEmpty(value)) return false;
        return ("," + csv.replace(" ", "") + ",").contains("," + value + ",");
    }

    private static boolean contains(JSONArray arr, String value) {
        for (int i = 0; i < arr.length(); i++) {
            if (value.trim().equals(arr.optString(i))) return true;
        }
        return false;
    }
}
