import { existsSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tools = resolve(root, ".tools");
const task = process.argv[2] || "assembleDebug";
if (
  ![
    "sdk",
    "clean",
    "assembleDebug",
    "assembleRelease",
    "bundleRelease",
    "lint",
    "test",
    "testDebugUnitTest",
  ].includes(task)
)
  throw new Error("Unsupported Android task.");
const jdkRoot = resolve(tools, "android-jdk");
const javaHome =
  process.env.WEALTHPILOT_ANDROID_JAVA_HOME ||
  (existsSync(jdkRoot)
    ? resolve(
        jdkRoot,
        readdirSync(jdkRoot).find((p) => p.startsWith("jdk-")) || "",
      )
    : process.env.JAVA_HOME);
if (!javaHome || !existsSync(resolve(javaHome, "bin/javac")))
  throw new Error(
    "Run npm run android:tools, or set WEALTHPILOT_ANDROID_JAVA_HOME to a full JDK 21+.",
  );
const sdk = process.env.ANDROID_HOME || resolve(tools, "android-sdk");
const gradleHome = resolve(tools, "gradle-cache");
mkdirSync(gradleHome, { recursive: true });
mkdirSync(resolve(tools, "android-user"), { recursive: true });
const javaOptions = [];
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy) {
  const parsed = new URL(proxy);
  javaOptions.push(
    `-Dhttps.proxyHost=${parsed.hostname}`,
    `-Dhttps.proxyPort=${parsed.port || "80"}`,
    `-Dhttp.proxyHost=${parsed.hostname}`,
    `-Dhttp.proxyPort=${parsed.port || "80"}`,
  );
}
// Use the existing platform Java CA store when provided; retain TLS verification.
if (existsSync("/etc/ssl/certs/java/cacerts"))
  javaOptions.push("-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts");
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
  ANDROID_USER_HOME: resolve(tools, "android-user"),
  GRADLE_USER_HOME: gradleHome,
  JAVA_OPTS: [process.env.JAVA_OPTS || "", ...javaOptions].join(" "),
};
function run(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: resolve(root, "android"),
    env,
    stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
    input,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (task === "sdk") {
  run(
    resolve(sdk, "cmdline-tools/latest/bin/sdkmanager"),
    [
      "--sdk_root=" + sdk,
      "platforms;android-36",
      "build-tools;36.0.0",
      "platform-tools",
    ],
    "y\n".repeat(100),
  );
} else {
  if (!existsSync(resolve(tools, "android-debug.keystore"))) {
    run(resolve(javaHome, "bin/keytool"), [
      "-genkeypair",
      "-keystore",
      resolve(tools, "android-debug.keystore"),
      "-storepass",
      "android",
      "-keypass",
      "android",
      "-alias",
      "AndroidDebugKey",
      "-dname",
      "CN=WealthPilot Local Test",
      "-keyalg",
      "RSA",
      "-keysize",
      "2048",
      "-validity",
      "3650",
    ]);
  }
  const localGradle = resolve(tools, "gradle-8.14.3/bin/gradle");
  run(
    existsSync(localGradle) ? localGradle : resolve(root, "android/gradlew"),
    ["--no-daemon", "--console=plain", task],
  );
  if (task === "assembleDebug") {
    run(resolve(sdk, "build-tools/36.0.0/apksigner"), [
      "verify",
      "--verbose",
      resolve(root, "android/app/build/outputs/apk/debug/app-debug.apk"),
    ]);
    mkdirSync(resolve(root, "artifacts"), { recursive: true });
    copyFileSync(
      resolve(root, "android/app/build/outputs/apk/debug/app-debug.apk"),
      resolve(root, "artifacts/wealthpilot-debug.apk"),
    );
    console.log(
      "Private test APK: artifacts/wealthpilot-debug.apk. Release signing and device validation remain separate.",
    );
  }
}
