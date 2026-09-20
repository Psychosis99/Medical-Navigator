package com.mednav.navigator;

/**
 * The pilot dataset that ships inside the APK so the app is useful with zero
 * connectivity — the Tier-2/Tier-3 reality the MVP targets.
 *
 * IMPORTANT: every provider below is FICTIONAL sample data for the pilot build.
 * Doctor, hospital, lab and insurer names are invented; fees and test prices are
 * indicative bands collected from public price ranges, not quotes. Nothing here
 * is a real listing and the UI labels it as sample data throughout. Replace this
 * file with a curated, consent-verified provider feed before any real pilot.
 *
 * Rows are pipe-delimited to keep the seed compact and diff-friendly;
 * {@link DbHelper} splits and inserts them.
 */
final class SeedData {

    private SeedData() { }

    /** Seed version — bump to force a re-seed on upgrade. */
    static final int SEED_VERSION = 1;

    /** id|name|city|area|type|address|phone|distance_km|beds|cashless|rating|rating_count|abdm|emergency */
    static final String[] HOSPITALS = {
        "h_tvm|Teesta Valley Multispeciality|Siliguri|Sevoke Road|private|3rd Mile, Sevoke Road, Siliguri 734001|03532500101|3.2|180|ins_sanjeevani,ins_bharatsure,ins_mediraksha|4.1|612|1|1",
        "h_nbc|North Bengal Care Hospital|Siliguri|Matigara|private|NH-31, Matigara, Siliguri 734010|03532500202|7.8|240|ins_sanjeevani,ins_mediraksha,ins_arogyafirst|3.8|489|1|1",
        "h_sjd|Sadar Jilla District Hospital|Siliguri|Hospital Road|govt|Hospital Road, Siliguri 734001|03532500303|2.1|320|scheme_pmjay,scheme_swasthya|3.4|208|1|1",
        "h_hmt|Himalayan Mission Trust Hospital|Siliguri|Pradhan Nagar|trust|Pradhan Nagar, Siliguri 734003|03532500404|4.6|90|ins_bharatsure,scheme_swasthya|4.3|338|0|1",
        "h_kmc|Kalighat Medical Centre|Kolkata|Kalighat|private|Sadananda Road, Kalighat, Kolkata 700026|03324500505|5.4|300|ins_sanjeevani,ins_bharatsure,ins_mediraksha,ins_arogyafirst|4.2|1284|1|1",
        "h_srt|Salt Lake Renal & Diabetes Institute|Kolkata|Salt Lake|private|Sector V, Salt Lake, Kolkata 700091|03324500606|11.2|160|ins_sanjeevani,ins_mediraksha|4.4|902|1|0",
        "h_bgh|Bidhan General Hospital|Kolkata|Beleghata|govt|Beleghata Main Road, Kolkata 700010|03324500707|6.9|500|scheme_pmjay,scheme_swasthya|3.3|771|1|1",
        "h_jpg|Jalpaiguri Sadar Care Centre|Jalpaiguri|Sadar|private|Station Road, Jalpaiguri 735101|03561500808|1.8|75|ins_bharatsure,ins_arogyafirst,scheme_swasthya|3.9|174|0|1",
        "h_dgp|Durgapur Steel Belt Hospital|Durgapur|City Centre|private|City Centre, Durgapur 713216|03432500909|3.7|210|ins_sanjeevani,ins_mediraksha,scheme_pmjay|4.0|523|1|1",
        "h_ccu|Coochbehar Community Hospital|Cooch Behar|Sagardighi|trust|Sagardighi, Cooch Behar 736101|03582501010|2.4|60|scheme_swasthya,ins_arogyafirst|3.7|96|0|0"
    };

    /**
     * id|name|specialty|qualification|exp|city|hospital_id|languages|opd_min|opd_max|
     * tele_fee|rating|rating_count|insurers|next_slot|govt_scheme|bio
     */
    static final String[] DOCTORS = {
        "d_001|Dr. Ananya Basu|Endocrinology|MBBS, MD (Medicine), DM (Endocrinology)|14|Siliguri|h_tvm|Bengali,Hindi,English|450|700|150|4.2|186|ins_sanjeevani,ins_bharatsure|Tomorrow 10:30 AM|0|Type-2 diabetes, thyroid and PCOS care. Runs a weekly diabetic foot clinic.",
        "d_002|Dr. Rajib Sarkar|Endocrinology|MBBS, MD, DNB (Endocrinology)|9|Siliguri|h_nbc|Bengali,Hindi|500|650|120|3.9|97|ins_sanjeevani,ins_mediraksha,ins_arogyafirst|Today 6:00 PM|0|Diabetes reversal counselling and insulin titration for working adults.",
        "d_003|Dr. Meenakshi Rai|Endocrinology|MBBS, MD (Medicine)|6|Siliguri|h_sjd|Nepali,Hindi,Bengali|10|50|0|3.6|64|scheme_pmjay,scheme_swasthya|Wed 9:00 AM|1|District hospital OPD. Lowest-cost verified option for chronic diabetes follow-up.",
        "d_004|Dr. Subhankar Dutta|General Medicine|MBBS, MD (General Medicine)|11|Siliguri|h_tvm|Bengali,Hindi,English|350|500|100|4.0|241|ins_sanjeevani,ins_bharatsure,ins_mediraksha|Today 5:15 PM|0|First-contact physician for fever, BP and diabetes screening.",
        "d_005|Dr. Farhan Ahmed|General Medicine|MBBS, DNB (Family Medicine)|8|Siliguri|h_hmt|Hindi,Urdu,Bengali|200|300|80|4.3|158|ins_bharatsure,scheme_swasthya|Tomorrow 11:00 AM|1|Trust-hospital OPD with subsidised follow-ups.",
        "d_006|Dr. Piyali Ghosh|Cardiology|MBBS, MD, DM (Cardiology)|16|Siliguri|h_nbc|Bengali,English|700|1000|250|4.5|312|ins_sanjeevani,ins_mediraksha|Fri 12:00 PM|0|Interventional cardiology; post-MI and heart-failure follow-up.",
        "d_007|Dr. Nirmal Chettri|Orthopaedics|MBBS, MS (Orthopaedics)|12|Siliguri|h_tvm|Nepali,Hindi,Bengali|500|700|150|4.1|203|ins_sanjeevani,ins_arogyafirst|Today 7:00 PM|0|Knee and shoulder injuries, geriatric fracture care.",
        "d_008|Dr. Sharmila Paul|Obstetrics & Gynaecology|MBBS, MS (Obs & Gynae)|13|Siliguri|h_hmt|Bengali,Hindi|400|600|120|4.4|287|ins_bharatsure,ins_mediraksha,scheme_swasthya|Tomorrow 9:30 AM|1|Antenatal care, PCOS, high-risk pregnancy counselling.",
        "d_009|Dr. Arindam Saha|Paediatrics|MBBS, MD (Paediatrics)|10|Siliguri|h_nbc|Bengali,Hindi,English|400|550|120|4.2|219|ins_sanjeevani,ins_bharatsure|Today 4:00 PM|0|Newborn follow-up, immunisation, childhood asthma.",
        "d_010|Dr. Kaushik Roy|Nephrology|MBBS, MD, DM (Nephrology)|15|Siliguri|h_nbc|Bengali,English,Hindi|700|900|250|4.3|142|ins_sanjeevani,ins_mediraksha|Sat 11:00 AM|0|Diabetic kidney disease and dialysis planning.",
        "d_011|Dr. Tanushree Mitra|Dermatology|MBBS, MD (Dermatology)|7|Siliguri|h_tvm|Bengali,Hindi|450|600|130|4.0|176|ins_sanjeevani,ins_arogyafirst|Today 6:30 PM|0|Chronic skin infection, acne, diabetic skin care.",
        "d_012|Dr. Pradip Barman|Ophthalmology|MBBS, MS (Ophthalmology)|18|Siliguri|h_hmt|Bengali,Hindi|300|450|100|4.5|264|ins_bharatsure,scheme_pmjay,scheme_swasthya|Tomorrow 8:30 AM|1|Cataract surgery and diabetic retinopathy screening camps.",
        "d_013|Dr. Ritu Agarwal|Psychiatry|MBBS, MD (Psychiatry)|9|Siliguri|h_tvm|Hindi,Bengali,English|600|800|200|4.1|88|ins_sanjeevani,ins_mediraksha|Thu 3:00 PM|0|Anxiety, depression, chronic-illness counselling.",
        "d_014|Dr. Sanjay Oraon|Pulmonology|MBBS, MD (Pulmonary Medicine)|11|Siliguri|h_nbc|Hindi,Bengali|550|750|180|3.8|121|ins_mediraksha,ins_arogyafirst|Fri 5:00 PM|0|COPD, asthma and TB follow-up care.",
        "d_015|Dr. Soumitra Bhattacharya|Endocrinology|MBBS, MD, DM (Endocrinology)|20|Kolkata|h_srt|Bengali,English,Hindi|900|1200|300|4.6|1043|ins_sanjeevani,ins_mediraksha|Mon 11:00 AM|0|Complex diabetes, insulin pumps, thyroid cancer follow-up.",
        "d_016|Dr. Nandita Sen|Endocrinology|MBBS, MD (Medicine), DNB (Endo)|10|Kolkata|h_kmc|Bengali,Hindi,English|700|900|220|4.3|418|ins_sanjeevani,ins_bharatsure,ins_arogyafirst|Today 7:30 PM|0|Gestational diabetes and adolescent endocrine care.",
        "d_017|Dr. Imran Khan|General Medicine|MBBS, MD (General Medicine)|12|Kolkata|h_bgh|Hindi,Bengali,Urdu|10|40|0|3.5|332|scheme_pmjay,scheme_swasthya|Tue 9:00 AM|1|Government OPD; free chronic-disease medicines where stocked.",
        "d_018|Dr. Debolina Roy|Cardiology|MBBS, MD, DM (Cardiology)|14|Kolkata|h_kmc|Bengali,English|1000|1400|350|4.4|766|ins_sanjeevani,ins_mediraksha,ins_bharatsure|Wed 1:00 PM|0|Preventive cardiology and hypertension clinics.",
        "d_019|Dr. Sujoy Naskar|Nephrology|MBBS, MD, DM (Nephrology)|17|Kolkata|h_srt|Bengali,Hindi,English|900|1100|300|4.5|388|ins_sanjeevani,ins_mediraksha|Thu 10:00 AM|0|CKD staging, transplant work-up.",
        "d_020|Dr. Poulomi Das|Obstetrics & Gynaecology|MBBS, MS (Obs & Gynae), FMAS|11|Kolkata|h_kmc|Bengali,English,Hindi|800|1000|250|4.2|517|ins_sanjeevani,ins_arogyafirst|Tomorrow 12:30 PM|0|Laparoscopic gynae surgery, infertility counselling.",
        "d_021|Dr. Bikash Mondal|Orthopaedics|MBBS, MS (Orthopaedics)|9|Durgapur|h_dgp|Bengali,Hindi|450|600|140|3.9|164|ins_sanjeevani,ins_mediraksha,scheme_pmjay|Today 5:45 PM|1|Industrial injury and joint replacement follow-up.",
        "d_022|Dr. Anju Lama|General Medicine|MBBS|5|Jalpaiguri|h_jpg|Nepali,Hindi,Bengali|150|250|60|3.7|58|ins_arogyafirst,scheme_swasthya|Today 3:30 PM|1|Everyday illnesses and chronic-disease refills.",
        "d_023|Dr. Hiranmoy Deb|Endocrinology|MBBS, MD (Medicine), Fellowship Diabetology|8|Jalpaiguri|h_jpg|Bengali,Hindi|300|450|110|3.8|71|ins_bharatsure,ins_arogyafirst,scheme_swasthya|Sat 10:00 AM|1|Nearest diabetes specialist for Jalpaiguri and Dhupguri belt.",
        "d_024|Dr. Moitreyee Kar|Paediatrics|MBBS, DCH|6|Durgapur|h_dgp|Bengali,Hindi|300|400|100|4.0|132|ins_mediraksha,scheme_pmjay|Tomorrow 10:00 AM|1|Child nutrition and growth monitoring.",
        "d_025|Dr. Gopal Singha|ENT|MBBS, MS (ENT)|13|Siliguri|h_tvm|Bengali,Hindi,Nepali|450|600|140|4.0|148|ins_sanjeevani,ins_bharatsure|Thu 6:00 PM|0|Chronic ear discharge, sinus and hearing assessment.",
        "d_026|Dr. Nazia Rahman|Gastroenterology|MBBS, MD, DM (Gastroenterology)|12|Kolkata|h_kmc|Bengali,Hindi,English|900|1200|300|4.3|402|ins_sanjeevani,ins_mediraksha|Fri 11:30 AM|0|Liver disease, acidity and IBS management."
    };

    /** code|name|typical_min|typical_max|fasting|note */
    static final String[] TESTS = {
        "hba1c|HbA1c (3-month sugar average)|350|700|0|Shows average blood sugar over ~3 months.",
        "fbs|Fasting blood sugar (FBS)|60|150|1|8-12 hours fasting needed.",
        "ppbs|Post-prandial blood sugar (PPBS)|60|150|0|Taken 2 hours after a meal.",
        "lipid|Lipid profile|400|900|1|Cholesterol and triglycerides.",
        "kft|Kidney function test (KFT)|400|800|0|Urea, creatinine, electrolytes.",
        "lft|Liver function test (LFT)|400|850|0|Checks liver enzymes.",
        "tsh|Thyroid profile (TSH/T3/T4)|350|750|0|Screens thyroid disorders.",
        "urine_micro|Urine microalbumin|350|600|0|Early kidney damage in diabetes.",
        "cbc|Complete blood count (CBC)|200|450|0|Infection and anaemia screen.",
        "ecg|ECG|150|400|0|Basic heart rhythm test.",
        "echo|Echocardiography|1200|2500|0|Heart pumping function.",
        "xray_chest|Chest X-ray|250|500|0|Lung and heart shadow.",
        "usg_abdomen|Ultrasound whole abdomen|800|1600|1|Liver, kidney, uterus imaging.",
        "vit_d|Vitamin D (25-OH)|900|1800|0|Often advised with bone pain.",
        "fundus|Retina / fundus examination|200|500|0|Diabetic eye screening.",
        "hb_sugar_pack|Diabetes basic package|900|1800|1|Bundled FBS + PPBS + HbA1c + lipid."
    };

    /** id|name|city|discount|home_collection|rating|phone|nabl */
    static final String[] LABS = {
        "l_ne|North East Diagnostics|Siliguri|20|1|4.1|03532511101|1",
        "l_tv|Teesta Path Lab|Siliguri|15|1|3.9|03532511102|1",
        "l_hm|Himalayan Mission Lab|Siliguri|30|0|4.2|03532511103|0",
        "l_kc|Kolkata City Diagnostics|Kolkata|18|1|4.0|03324511104|1",
        "l_sl|Salt Lake Reference Lab|Kolkata|12|1|4.4|03324511105|1",
        "l_jp|Jalpaiguri Health Lab|Jalpaiguri|25|0|3.6|03561511106|0",
        "l_dg|Durgapur Medipoint Lab|Durgapur|22|1|3.8|03432511107|1"
    };

    /** lab_id|test_code|price  (partner rate already reflects the network discount) */
    static final String[] LAB_TESTS = {
        "l_ne|hba1c|420", "l_ne|fbs|70", "l_ne|ppbs|70", "l_ne|lipid|520", "l_ne|kft|540",
        "l_ne|urine_micro|390", "l_ne|tsh|430", "l_ne|cbc|240", "l_ne|hb_sugar_pack|1050",
        "l_tv|hba1c|480", "l_tv|fbs|80", "l_tv|ppbs|80", "l_tv|lipid|560", "l_tv|kft|610",
        "l_tv|cbc|260", "l_tv|hb_sugar_pack|1240", "l_tv|usg_abdomen|1100",
        "l_hm|hba1c|380", "l_hm|fbs|60", "l_hm|ppbs|60", "l_hm|lipid|450", "l_hm|kft|480",
        "l_hm|cbc|200", "l_hm|hb_sugar_pack|940", "l_hm|fundus|220",
        "l_kc|hba1c|550", "l_kc|lipid|680", "l_kc|kft|700", "l_kc|lft|720", "l_kc|echo|1800",
        "l_kc|cbc|300", "l_kc|hb_sugar_pack|1500", "l_kc|usg_abdomen|1300",
        "l_sl|hba1c|600", "l_sl|lipid|750", "l_sl|kft|780", "l_sl|vit_d|1400", "l_sl|tsh|650",
        "l_jp|hba1c|450", "l_jp|fbs|75", "l_jp|lipid|540", "l_jp|kft|560", "l_jp|cbc|230",
        "l_dg|hba1c|470", "l_dg|lipid|580", "l_dg|kft|590", "l_dg|ecg|250", "l_dg|cbc|250"
    };

    /** id|name|kind|tpa|helpline|note   (kind: insurer | scheme) */
    static final String[] INSURERS = {
        "ins_sanjeevani|Sanjeevani Health Insurance|insurer|MediAssist-style TPA|1800-000-0011|Cashless at network hospitals with pre-authorisation.",
        "ins_bharatsure|Bharat Sure General|insurer|In-house claims desk|1800-000-0022|Cashless plus reimbursement within 30 days of discharge.",
        "ins_mediraksha|MediRaksha Family Floater|insurer|Paramount-style TPA|1800-000-0033|Family floater; room-rent capped by plan tier.",
        "ins_arogyafirst|ArogyaFirst Micro Cover|insurer|Regional TPA|1800-000-0044|Low-premium micro cover popular in semi-urban belts.",
        "scheme_pmjay|Ayushman Bharat PM-JAY (govt scheme)|scheme|State Health Agency|14555|Free treatment up to the scheme limit at empanelled hospitals for eligible families.",
        "scheme_swasthya|Swasthya Sathi (West Bengal, govt scheme)|scheme|State Health Agency|18003455384|Smart-card based cashless cover at empanelled hospitals in West Bengal."
    };

    /**
     * insurer_id|plan|kind|heading|body
     * kind: covered | waiting | excluded | process | limit
     * Illustrative wording for the demo policy reader — NOT a real policy.
     */
    static final String[] POLICY_CLAUSES = {
        "ins_sanjeevani|Silver|covered|In-patient hospitalisation|Room, nursing, surgeon, ICU and medicine charges are covered when the patient is admitted for more than 24 hours at a network or non-network hospital, up to the sum insured.",
        "ins_sanjeevani|Silver|covered|Day-care procedures|Listed day-care procedures such as cataract surgery and dialysis are covered even without a 24-hour stay.",
        "ins_sanjeevani|Silver|limit|Room rent cap|Room rent is payable up to 1% of sum insured per day. Choosing a costlier room can proportionately reduce the whole claim.",
        "ins_sanjeevani|Silver|waiting|Pre-existing disease waiting period|Diabetes, hypertension and other declared pre-existing conditions are covered after 36 months of continuous cover.",
        "ins_sanjeevani|Silver|excluded|OPD consultation and routine tests|Doctor visits, lab tests and medicines taken without hospitalisation are not payable under this plan.",
        "ins_sanjeevani|Silver|process|Cashless pre-authorisation|At a network hospital, the insurance desk must send the pre-auth form to the TPA at least 48 hours before a planned admission, or within 24 hours of an emergency admission.",
        "ins_bharatsure|Standard|covered|Pre and post hospitalisation|Expenses 30 days before and 60 days after admission are covered if related to the same hospitalisation.",
        "ins_bharatsure|Standard|waiting|Initial waiting period|Except accidents, no claim is payable in the first 30 days of the first policy year.",
        "ins_bharatsure|Standard|excluded|Non-medical consumables|Gloves, syringes, administrative and registration charges are not payable and are billed to the patient.",
        "ins_bharatsure|Standard|process|Reimbursement claim|If the hospital is outside the network, pay the bill and submit discharge summary, original bills, investigation reports and the claim form within 30 days of discharge.",
        "ins_mediraksha|Family Floater|covered|Maternity benefit|Delivery is covered after 24 months of continuous cover, with a per-delivery sub-limit.",
        "ins_mediraksha|Family Floater|limit|Sub-limit on cataract|Cataract surgery is payable up to a fixed amount per eye irrespective of the actual bill.",
        "ins_mediraksha|Family Floater|waiting|Specific disease waiting|Hernia, piles, cataract and joint replacement are covered after 24 months.",
        "ins_mediraksha|Family Floater|process|Portability|Waiting periods already served can be carried over if the policy is ported at least 45 days before renewal.",
        "ins_arogyafirst|Micro|covered|Fixed-benefit hospitalisation|A fixed daily cash amount is paid for each night of admission, regardless of the actual bill.",
        "ins_arogyafirst|Micro|excluded|Diagnostics-only admission|Admission purely for investigation without active treatment is not payable.",
        "ins_arogyafirst|Micro|process|Intimation window|The insurer must be informed within 24 hours of admission by phone or app, otherwise the claim can be reduced.",
        "scheme_pmjay|PM-JAY|covered|Empanelled hospital package|Treatment follows fixed package rates at empanelled hospitals and is cashless for eligible families; the hospital cannot charge extra for package items.",
        "scheme_pmjay|PM-JAY|process|Eligibility and card|Carry the Ayushman card or verify eligibility at the hospital Ayushman Mitra desk with a ration card and Aadhaar.",
        "scheme_swasthya|Swasthya Sathi|covered|Family cover|Cashless secondary and tertiary care at empanelled hospitals in the state, with the card issued in the name of the eldest woman of the family.",
        "scheme_swasthya|Swasthya Sathi|process|At the hospital|Show the smart card at the Swasthya Sathi help desk before admission; the hospital raises the pre-auth on the state portal."
    };

    /**
     * id|label|specialty|tests|red_flags|keywords
     * A deliberately simple rule table — no AI in the MVP, which keeps the triage
     * auditable and lets a clinician review every mapping before a pilot.
     */
    static final String[] CONDITIONS = {
        "c_diabetes|High blood sugar / diabetes|Endocrinology|hba1c,fbs,ppbs,lipid,kft,urine_micro|Fruity breath with drowsiness, vomiting, or sugar above 400 mg/dL — go to an emergency room now.|sugar,diabetes,diabetic,madhumeha,thirst,urination,weight loss,hba1c",
        "c_thyroid|Thyroid problem|Endocrinology|tsh,cbc,lipid|Severe neck swelling with breathing difficulty needs emergency care.|thyroid,goitre,neck swelling,weight gain,hair fall,tsh",
        "c_bp|High blood pressure|General Medicine|kft,lipid,ecg,cbc|Chest pain, sudden weakness on one side or vision loss — emergency.|bp,pressure,hypertension,headache,giddiness",
        "c_chest|Chest pain or breathlessness|Cardiology|ecg,echo,lipid,cbc|Crushing chest pain, sweating or pain spreading to the arm or jaw — call an ambulance immediately.|chest pain,heart,palpitation,breathless,attack",
        "c_kidney|Swelling, urine or kidney problem|Nephrology|kft,urine_micro,usg_abdomen,cbc|No urine output for a day, or breathlessness with swelling — emergency.|kidney,swelling,urine,creatinine,dialysis,foamy",
        "c_fever|Fever, cough or infection|General Medicine|cbc,xray_chest|Fever above 103F with confusion, fits or blue lips — emergency.|fever,cough,cold,flu,body ache,typhoid,dengue",
        "c_stomach|Stomach pain or acidity|Gastroenterology|lft,usg_abdomen,cbc|Black stools, vomiting blood or rigid abdomen — emergency.|stomach,acidity,gas,liver,jaundice,loose motion,vomiting",
        "c_joint|Joint or back pain|Orthopaedics|cbc,vit_d,xray_chest|Loss of bladder control or sudden leg weakness with back pain — emergency.|joint,knee,back,pain,fracture,arthritis,cervical",
        "c_pregnancy|Pregnancy care|Obstetrics & Gynaecology|cbc,tsh,usg_abdomen,fbs|Bleeding, severe abdominal pain or reduced baby movement — go to the labour room now.|pregnant,pregnancy,antenatal,delivery,period,pcos,irregular",
        "c_child|Child illness|Paediatrics|cbc,xray_chest|Refusing feeds, fits, or chest drawing-in while breathing — emergency.|child,baby,infant,vaccination,growth,kid",
        "c_skin|Skin problem|Dermatology|cbc,fbs|Rapidly spreading painful skin with fever — emergency.|skin,rash,itching,acne,fungal,hair",
        "c_eye|Eye problem|Ophthalmology|fundus,fbs|Sudden vision loss or eye injury — emergency.|eye,vision,cataract,blurred,retina",
        "c_breath|Asthma, COPD or long cough|Pulmonology|xray_chest,cbc|Unable to speak full sentences, blue lips — emergency.|asthma,copd,wheezing,tb,cough,smoking",
        "c_mental|Stress, sleep or mood problem|Psychiatry|tsh,cbc,vit_d|Thoughts of self-harm — call a helpline or go to the nearest hospital now.|stress,depression,anxiety,sleep,tension,mood",
        "c_ent|Ear, nose or throat problem|ENT|cbc|Severe bleeding from nose or ear with injury — emergency.|ear,nose,throat,hearing,sinus,tonsil",
        "c_checkup|General health check-up|General Medicine|cbc,fbs,lipid,kft,lft,tsh|-|checkup,screening,annual,healthy,master health"
    };

    /**
     * The in-house care team a patient reaches first — the service's own
     * consultants rather than a listing from the directory. This is the app's
     * primary promise: someone answerable who tells you which specialist you
     * actually need before you spend anything.
     *
     * id|name|role|title|qualification|specialty|exp_years|languages|hours|sla|
     * fee_note|rating|rating_count|helps_with|bio
     *
     * role: primary | associate | coordinator | insurance
     */
    static final String[] CONSULTANTS = {
        "cn_lead|Dr. Ipsita Sengupta|primary|Lead Consultant, Care Team|MBBS, MD (General Medicine)|General Medicine|16|Bengali,Hindi,English|Mon-Sat, 8:00 AM - 9:00 PM|Replies within 30 minutes in working hours|First consult free. Follow-ups Rs 199.|4.7|1268|Which specialist you need,Second opinion on a prescription,Understanding a test report,Whether a test is really necessary,Which hospital to choose|Your first point of contact. Sixteen years in general medicine and family practice across North Bengal, with a habit of asking what a test will change before ordering it.",
        "cn_assoc|Dr. Arnab Roy|associate|Associate Consultant|MBBS, DNB (Family Medicine)|Family Medicine|9|Hindi,Bengali,Nepali|Mon-Sun, 7:00 AM - 11:00 PM|Replies within 1 hour|First consult free. Follow-ups Rs 149.|4.5|734|Everyday illness,Medicine doubts,Child and elderly care questions,After-hours queries|Covers early mornings, late nights and Sundays, so there is always someone to ask.",
        "cn_coord|Rina Tamang|coordinator|Care Coordinator|Health administration|Appointments and logistics|7|Nepali,Hindi,Bengali|Mon-Sat, 9:00 AM - 7:00 PM|Calls back within 2 hours|Free|4.6|512|Booking an appointment,Arranging lab tests,Getting reports collected,Travel and timing for a hospital visit|Handles the running around: slots, labs, report pickups and what to carry.",
        "cn_ins|Sourav Mitra|insurance|Insurance Desk|Health insurance claims|Cashless and claims|11|Bengali,Hindi,English|Mon-Sat, 10:00 AM - 6:00 PM|Replies within 3 hours|Free|4.4|398|Cashless pre-authorisation,Documents for a claim,A rejected or reduced claim,Choosing a network hospital|Sits between you and the TPA so a claim does not stall on a missing paper."
    };

    /** Why a patient reaches out. id|label|consultant_role|hint */
    static final String[] CONSULT_TOPICS = {
        "t_which|Which doctor should I see?|primary|Describe the problem; you get a specialty and a shortlist.",
        "t_second|Second opinion on my prescription|primary|List the medicines and doses you were given.",
        "t_report|Help me understand my report|primary|Type the values, or the test name and result.",
        "t_needed|Is this test really needed?|primary|Tell us what was advised and why.",
        "t_hospital|Which hospital should I go to?|primary|We weigh cost, distance and whether your cover works there.",
        "t_everyday|Everyday illness or medicine doubt|associate|Fever, pain, stomach upset, dosage questions.",
        "t_appoint|Book an appointment or lab test|coordinator|We arrange the slot and tell you what to carry.",
        "t_claim|Help with insurance or a claim|insurance|Pre-authorisation, documents, or a claim that stalled.",
        "t_other|Something else|primary|Tell us in your own words."
    };

    /** Canned tele-consult replies. specialty|trigger_keywords|reply */
    static final String[] CHAT_RULES = {
        "*|emergency,severe,unconscious,bleeding,chest pain|This sounds like it may need emergency care rather than a chat. Please go to the nearest hospital with an emergency unit, or use the Emergency button on the home screen.",
        "Endocrinology|sugar,hba1c,fasting,insulin|Please share your last fasting and post-meal sugar readings, and your HbA1c if done in the last 3 months. If HbA1c is above 8%, we usually review the medicine dose rather than just the diet.",
        "Endocrinology|diet,food,eat,rice|Keep the plate simple: half vegetables, a quarter protein (dal, egg, fish), a quarter rice or roti. Two small portions of rice a day is fine — timing and portion matter more than fully avoiding it.",
        "Endocrinology|test,report|Basic follow-up is HbA1c, fasting and post-meal sugar, lipid profile, kidney function and urine microalbumin once a year. The Cost estimate screen shows the partner-lab price for that set.",
        "Cardiology|bp,pressure,palpitation|Please note your BP twice a day for a week, sitting and rested, and bring the readings. Carry your old ECG if you have one.",
        "General Medicine|fever,cough,cold|If fever has crossed 3 days, a CBC and a check for dengue or typhoid is usually advised. Keep a temperature log and stay on oral fluids meanwhile.",
        "Obstetrics & Gynaecology|period,pcos,irregular|Please note the last three period dates and any weight change. A thyroid profile and a pelvic ultrasound are the usual first tests.",
        "Paediatrics|child,baby,feed,fever|Please share the child's weight, age and temperature, and whether feeding is normal. Reduced feeding or drowsiness needs an in-person visit the same day.",
        "Nephrology|creatinine,kidney,swelling|Please share your latest creatinine and urine report, and list every painkiller you take — many are hard on the kidneys.",
        "*|cost,fee,price,money|The Cost estimate screen gives the OPD plus test band for your city, and Insurance help shows whether the hospital is in your network. Ask me before any test if you want a cheaper equivalent.",
        "*|insurance,claim,cashless|For a planned admission, the hospital insurance desk should raise a cashless pre-authorisation at least 48 hours ahead. The Insurance help screen has the document checklist to carry.",
        "*|medicine,tablet,dose|I cannot change a prescription over chat without seeing your current records. Please upload or type your current medicines and I will review them at the consult.",
        "*|thanks,thank you,ok|Noted. If anything worsens before the visit, use the Emergency button or call the hospital directly.",
        "General Medicine|which doctor,which specialist,who should i see|Tell me the main problem, how long it has been going on, and your age. In most cases we start with a physician and only move to a specialist if the first set of tests points there - that usually saves one full consultation fee.",
        "General Medicine|second opinion,prescription,medicines|Please type each medicine with its dose and how long you have been taking it. I will flag anything duplicated, anything that clashes, and anything you could ask your doctor to justify.",
        "General Medicine|report,value,result|Type the test name and the value, with the lab's normal range if printed. I will tell you whether it needs action now, watching, or nothing at all.",
        "General Medicine|is this test needed,why this test,so many tests|Fair question to ask. Tell me what was advised and for what complaint, and I will say which ones change the treatment and which can wait.",
        "General Medicine|which hospital,where should i go,admission|I will weigh three things for you: distance, the likely bill, and whether your cover is accepted there. Tell me your city and what the admission is for.",
        "Appointments and logistics|book,appointment,slot,lab,report|I can arrange it. Tell me the doctor or test, the city, and roughly when suits you - morning, afternoon or evening - and I will confirm the slot and what to carry.",
        "Cashless and claims|claim,cashless,pre-auth,rejected,tpa|Send me the hospital name, your insurer and what stage you are at. If a claim was reduced or rejected, the reason letter matters most - type what it says."
    };
}
