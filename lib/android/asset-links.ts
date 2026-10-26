/** Only the public SHA-256 certificate fingerprints belong here; never signing keys. */
export function androidAssetLinks(fingerprints: string | undefined) {
  const certificates = [
    ...new Set(
      (fingerprints || "")
        .split(",")
        .map((v) => v.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  if (!certificates.length) return [];
  if (certificates.some((v) => !/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(v))) {
    throw new Error(
      "Android certificate fingerprints must be colon-separated SHA-256 digests.",
    );
  }
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.wealthpilot.app",
        sha256_cert_fingerprints: certificates,
      },
    },
  ];
}
