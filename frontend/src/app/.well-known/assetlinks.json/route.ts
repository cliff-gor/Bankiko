import { NextResponse } from "next/server";

// Android App Links verification file.
// The sha256_cert_fingerprints must be updated with the real signing key
// fingerprint once the app is signed for production on Google Play.
// Until then this enables the fallback web experience (store redirect).
const assetLinks = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "ke.cliffgor.bankiko",
      sha256_cert_fingerprints: [
        // Replace with: keytool -printcert -jarfile your-app.apk | grep SHA256
        "REPLACE_WITH_REAL_SHA256_FINGERPRINT"
      ],
    },
  },
];

export function GET() {
  return NextResponse.json(assetLinks, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
