#!/usr/bin/env bash
# Assembles a minimal Android build toolchain from Maven Central only.
#
# Why not the Android SDK? This project is built in a locked-down CI/sandbox
# environment where dl.google.com (and therefore sdkmanager and Google's Maven
# mirror) is unreachable. Every piece below is a published Maven artifact, so
# the build needs nothing but a JDK, Python 3 and network access to Central:
#
#   aapt2         <- org.apktool:apktool-lib      (bundles the linux aapt2 binary)
#   framework res <- org.apktool:apktool-lib      (android framework resources for -I)
#   android.jar   <- org.robolectric:android-all  (API 34 framework classes, stripped)
#   dx            <- com.jakewharton.android.repackaged:dalvik-dx (class -> dex)
#   apksig        <- com.android.tools.build:apksig (APK Signature Scheme v2)
#
# If a real Android SDK is available, prefer it: set ANDROID_HOME and adapt
# tools/build.sh, which only needs aapt2, a dexer, android.jar and apksigner.
set -euo pipefail

TOOLCHAIN="${TOOLCHAIN:-$(cd "$(dirname "$0")/.." && pwd)/.toolchain}"
CENTRAL="${CENTRAL:-https://repo1.maven.org/maven2}"

APKTOOL_VERSION=3.0.3
ANDROID_ALL_VERSION=14-robolectric-10818077
DX_VERSION=16.0.1
APKSIG_VERSION=2.3.0

mkdir -p "$TOOLCHAIN"
cd "$TOOLCHAIN"

fetch() { # fetch <dest> <url>
  if [ -s "$1" ]; then
    echo "  have $1"
    return
  fi
  echo "  get  $1"
  curl -fsSL --retry 4 --retry-delay 2 -o "$1.part" "$2"
  mv "$1.part" "$1"
}

echo "Fetching build tools into $TOOLCHAIN"
fetch apktool-lib.jar \
  "$CENTRAL/org/apktool/apktool-lib/$APKTOOL_VERSION/apktool-lib-$APKTOOL_VERSION.jar"
fetch dalvik-dx.jar \
  "$CENTRAL/com/jakewharton/android/repackaged/dalvik-dx/$DX_VERSION/dalvik-dx-$DX_VERSION.jar"
fetch apksig.jar \
  "$CENTRAL/com/android/tools/build/apksig/$APKSIG_VERSION/apksig-$APKSIG_VERSION.jar"
fetch android-all.jar \
  "$CENTRAL/org/robolectric/android-all/$ANDROID_ALL_VERSION/android-all-$ANDROID_ALL_VERSION.jar"

if [ ! -x aapt2 ]; then
  echo "  extract aapt2 + framework resources"
  unzip -o -j -q apktool-lib.jar "prebuilt/linux/aapt2" "prebuilt/android-framework.jar" -d .
  chmod +x aapt2
fi

# android-all is a full framework *implementation* jar and also carries java.*,
# javax.* and sun.* copies of libcore. Those collide with the JDK's own platform
# classes during javac, so keep only the Android-specific packages: the result
# is a drop-in replacement for the SDK's android.jar on the compile classpath.
if [ ! -s android.jar ]; then
  echo "  build android.jar (stripping libcore/JDK overlaps)"
  python3 - "$PWD/android-all.jar" "$PWD/android.jar" <<'PY'
import sys, zipfile
src_path, out_path = sys.argv[1], sys.argv[2]
keep = ("android/", "dalvik/", "org/json/", "org/apache/http/",
        "org/xmlpull/", "org/w3c/dom/", "com/android/internal/", "com/android/i18n/")
kept = 0
with zipfile.ZipFile(src_path) as src, \
     zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as out:
    for info in src.infolist():
        if info.filename.endswith(".class") and info.filename.startswith(keep):
            out.writestr(info.filename, src.read(info.filename))
            kept += 1
print("    kept %d framework classes" % kept)
PY
fi

echo "Toolchain ready:"
ls -1sh aapt2 android.jar android-framework.jar dalvik-dx.jar apksig.jar
