import { NextResponse } from "next/server";

// iOS Universal Links verification file.
// The appID format is: <TeamID>.<BundleID>
// Replace TEAMID with your Apple Developer Team ID (10-char string).
const aasa = {
  applinks: {
    apps: [],
    details: [
      {
        appID: "TEAMID.ke.cliffgor.bankiko",
        paths: ["/join/*"],
      },
    ],
  },
};

export function GET() {
  return NextResponse.json(aasa, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
