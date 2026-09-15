import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Minimal replacement for the Android SDK apksigner tool (sign + verify). */
public final class ApkTool {

    public static void main(String[] args) throws Exception {
        if (args.length == 0) { usage(); return; }
        String cmd = args[0];
        if ("sign".equals(cmd)) {
            sign(args);
        } else if ("verify".equals(cmd)) {
            verify(new File(args[1]), Integer.parseInt(args[2]));
        } else {
            usage();
        }
    }

    private static void usage() {
        System.err.println("usage: ApkTool sign <keystore> <storepass> <alias> <keypass> <in.apk> <out.apk> <minSdk>");
        System.err.println("       ApkTool verify <apk> <minSdk>");
        System.exit(2);
    }

    private static void sign(String[] a) throws Exception {
        File store = new File(a[1]);
        char[] storePass = a[2].toCharArray();
        String alias = a[3];
        char[] keyPass = a[4].toCharArray();
        File in = new File(a[5]);
        File out = new File(a[6]);
        int minSdk = Integer.parseInt(a[7]);

        KeyStore ks = KeyStore.getInstance("PKCS12");
        FileInputStream fis = new FileInputStream(store);
        try { ks.load(fis, storePass); } finally { fis.close(); }

        PrivateKey key = (PrivateKey) ks.getKey(alias, keyPass);
        if (key == null) throw new IllegalStateException("no private key for alias " + alias);
        java.security.cert.Certificate[] chain = ks.getCertificateChain(alias);
        List<X509Certificate> certs = new ArrayList<X509Certificate>();
        for (java.security.cert.Certificate c : chain) certs.add((X509Certificate) c);

        ApkSigner.SignerConfig cfg =
                new ApkSigner.SignerConfig.Builder("MEDNAV", key, certs).build();
        ApkSigner signer = new ApkSigner.Builder(Collections.singletonList(cfg))
                .setInputApk(in)
                .setOutputApk(out)
                .setMinSdkVersion(minSdk)
                .setV1SigningEnabled(false)   // v1 (JAR) signing needs JDK-internal APIs removed after JDK 11
                .setV2SigningEnabled(true)   // APK Signature Scheme v2: required for API 30+, supported since API 24
                .setCreatedBy("medical-navigator-build")
                .build();
        signer.sign();
        System.out.println("signed -> " + out.getPath());
    }

    private static void verify(File apk, int minSdk) throws Exception {
        ApkVerifier.Result r = new ApkVerifier.Builder(apk)
                .setMinCheckedPlatformVersion(minSdk)
                .build()
                .verify();
        System.out.println("verified      : " + r.isVerified());
        System.out.println("v1 scheme     : " + r.isVerifiedUsingV1Scheme());
        System.out.println("v2 scheme     : " + r.isVerifiedUsingV2Scheme());
        for (ApkVerifier.IssueWithParams e : r.getErrors()) System.out.println("ERROR   " + e);
        for (ApkVerifier.IssueWithParams w : r.getWarnings()) System.out.println("WARNING " + w);
        if (!r.isVerified()) System.exit(1);
    }
}
