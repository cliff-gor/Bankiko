"use client";

import { useState } from "react";
import { downloadSasraReport } from "@/lib/api";
import { FileText, Loader2, Download } from "lucide-react";

interface Props {
  groups: { id: string; name: string }[];
  token: string;
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function SasraReportsClient({ groups, token }: Props) {
  const now = new Date();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (!groupId) { setError("Select a group"); return; }
    setLoading(true);
    setError(null);
    try {
      const blob = await downloadSasraReport(token, groupId, year, month);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `SASRA_${MONTHS[month - 1]}_${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to generate report. Check that the group has data for this period.");
    }
    setLoading(false);
  }

  if (groups.length === 0) {
    return (
      <div className="border rounded-xl p-12 text-center space-y-3">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="font-medium">No SACCO groups found</p>
        <p className="text-muted-foreground text-sm">
          SASRA reports apply to SACCO groups only.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-6 space-y-6 max-w-lg">
      <div className="space-y-4">
        {/* Group */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">SACCO group</label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* Year + Month */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Year</label>
            <input
              type="number"
              value={year}
              min={2020}
              max={2030}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        onClick={download}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF…</>
          : <><Download className="w-4 h-4" /> Download SASRA Report</>
        }
      </button>

      <p className="text-xs text-muted-foreground">
        The report is generated as a PDF and downloaded to your device for submission to SASRA.
      </p>
    </div>
  );
}
