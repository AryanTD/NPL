#!/usr/bin/env python3
"""
clean_players.py — Build npl-2024.json from real Kaggle NPL 2024 data.

Reads team-specific batting + bowling CSVs, filters to Nepali players,
assigns categories (A/B/C) and roles (BAT/BOWL/WK/AR), outputs npl-2024.json.
"""

import csv
import json
import re
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────

KAGGLE_DIR = Path("/Users/aryantandon/Nepal-Premier-League-2024-Analysis")
BATTING_DIR = KAGGLE_DIR / "Player Averages" / "Batting Averages"
BOWLING_DIR = KAGGLE_DIR / "Player Averages" / "Balling Averages"
REPO_DIR = Path(__file__).parent.parent
OUTPUT_FILE = REPO_DIR / "players" / "npl-2024.json"

# ─── Team mapping ─────────────────────────────────────────────────────────────

TEAMS = [
    ("kathmandu_gurkhas",  "Kathmandu Gorkhas"),
    ("pokhara_avengers",   "Pokhara Avengers"),
    ("chitwan_rhinos",     "Chitwan Rhinos"),
    ("biratnagar_kings",   "Biratnagar Kings"),
    ("janakpur_bolts",     "Janakpur Bolts"),
    ("lumbini_lions",      "Lumbini Lions"),
    ("sudurpaschim_royals","Sudurpaschim Royals"),
    ("karnali_yaks",       "Karnali Yaks"),
]

# Batting file has a typo for one team
BATTING_OVERRIDE = {"sudurpaschim_royals": "sudupaschim_royals"}

# ─── Overseas exclusion list ──────────────────────────────────────────────────

OVERSEAS = {
    # New Zealand
    "MJ Guptill", "JDS Neesham", "SC Kuggeleijn",
    # England / Wales
    "RS Bopara", "SS Eskinazi", "TJ Moores", "NA Sowter", "M Levitt",
    "DA Douthwaite", "Basil Hameed", "MJJ Critchley",
    # South Africa / Namibia
    "LM Benkenstein", "MG Erasmus", "AGS Gous", "JN Loftie-Eaton",
    # West Indies / Caribbean
    "CAK Walton", "RA Reifer", "BWM Mike", "NR Kirton", "RR Simmonds",
    # Australia
    "WG Bosisto", "BCJ Cutting",
    # Scotland
    "MA Leask", "CB Sole",
    # Netherlands
    "BFW de Leede",
    # Afghanistan
    "Rashid Khan", "Hassan Eisakhil",
    # Pakistan
    "Aqib Ilyas", "SA Zaib", "Sohail Tanvir", "Saad Bin Zafar", "Ismat Alam",
    # India
    "S Dhawan", "Harmeet Singh",
    # UAE
    "Rohan Mustafa",
    # Oman
    "Zeeshan Maqsood",
    # Hong Kong
    "Babar Hayat",
    # Sri Lanka
    "BKEL Milantha",
    # Other non-Nepali
    "B Aagri", "DS Bajwa", "B McMullen", "J Tromp", "SA Edwards",
    # Aarif Sheikh ≠ Aasif Sheikh (marquee Nepali WK)
    "Aarif Sheikh",
}

# ─── Marquee players: Kaggle name → canonical ID ─────────────────────────────

MARQUEE_ID_MAP = {
    "Sandeep Lamichhane": "npl-sandeep-lamichhane",
    "S Lamichhane":       "npl-sandeep-lamichhane",
    "Kushal Malla":       "npl-kushal-malla",
    "Aasif Sheikh":       "npl-aasif-sheikh",
    "Sompal Kami":        "npl-sompal-kami",
    "Karan KC":           "npl-karan-kc",
    "RK Paudel":          "npl-rohit-paudel",
    "Rohit Paudel":       "npl-rohit-paudel",
    "K Bhurtel":          "npl-kushal-bhurtel",
    "Kushal Bhurtel":     "npl-kushal-bhurtel",
    "DS Airee":           "npl-dipendra-airee",
    "Dipendra Airee":     "npl-dipendra-airee",
}

# Marquee display names (for players whose Kaggle name is abbreviated)
MARQUEE_DISPLAY_NAMES = {
    "npl-rohit-paudel":    "Rohit Paudel",
    "npl-kushal-bhurtel":  "Kushal Bhurtel",
    "npl-dipendra-airee":  "Dipendra Singh Airee",
}

# Known wicket-keepers (by Kaggle name)
KNOWN_WK = {"Aasif Sheikh", "D Kharel"}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def parse_float(val: str | None) -> float | None:
    if not val or val.strip() in ("-", "", "–"):
        return None
    try:
        return float(val.strip())
    except ValueError:
        return None

def parse_int(val: str | None) -> int:
    if not val or val.strip() in ("-", "", "–"):
        return 0
    try:
        return int(float(val.strip()))
    except ValueError:
        return 0

def slugify(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9\s]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    return f"npl-{slug}"

def read_batting(prefix: str) -> dict[str, dict]:
    file_prefix = BATTING_OVERRIDE.get(prefix, prefix)
    path = BATTING_DIR / f"{file_prefix}_batting_averages.csv"
    if not path.exists():
        print(f"  [WARN] Missing: {path.name}")
        return {}
    result = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = row["player"].strip()
            if not name:
                continue
            result[name] = {
                "innings_batted": parse_int(row.get("innings_batted")),
                "runs":           parse_int(row.get("runs")),
                "batting_avg":    parse_float(row.get("batting_average")),
                "strike_rate":    parse_float(row.get("batting_strike_rate")),
            }
    return result

def read_bowling(prefix: str) -> dict[str, dict]:
    path = BOWLING_DIR / f"{prefix}_bowling_averages.csv"
    if not path.exists():
        print(f"  [WARN] Missing: {path.name}")
        return {}
    result = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = row["player"].strip()
            if not name:
                continue
            result[name] = {
                "innings_bowled": parse_int(row.get("innings_bowled")),
                "wickets":        parse_int(row.get("wickets")),
                "bowling_avg":    parse_float(row.get("bowling_average")),
                "economy":        parse_float(row.get("economy_rate")),
                "stumpings":      parse_int(row.get("stumpings")),
            }
    return result

def assign_role(name: str, bat: dict, bowl: dict) -> str:
    if name in KNOWN_WK or bowl.get("stumpings", 0) > 0:
        return "WK"
    innings_bowled = bowl.get("innings_bowled", 0)
    wickets        = bowl.get("wickets", 0)
    innings_batted = bat.get("innings_batted", 0)
    runs           = bat.get("runs", 0)
    if innings_bowled >= 4 and wickets >= 3 and innings_batted <= 2:
        return "BOWL"
    if runs >= 50 and wickets >= 3:
        return "AR"
    if innings_bowled >= 4 and wickets >= 3:
        return "BOWL"
    return "BAT"

def composite_score(bat: dict, bowl: dict) -> float:
    runs    = bat.get("runs") or 0
    avg     = bat.get("batting_avg") or 0
    sr      = bat.get("strike_rate") or 0
    wickets = bowl.get("wickets") or 0
    eco     = bowl.get("economy") or 0
    score   = (runs * 0.5) + (avg * 10) + (sr * 2) + (wickets * 150)
    if eco > 0:
        score += max(0, (10 - eco) * 20)
    return score

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    all_players: list[dict] = []
    seen_ids: set[str] = set()

    for prefix, franchise in TEAMS:
        print(f"\n{franchise}")
        batting = read_batting(prefix)
        bowling = read_bowling(prefix)
        names = set(batting) | set(bowling)

        overseas_found = []
        nepali_count = 0

        for name in names:
            if name in OVERSEAS:
                overseas_found.append(name)
                continue

            bat  = batting.get(name, {"innings_batted": 0, "runs": 0, "batting_avg": None, "strike_rate": None})
            bowl = bowling.get(name, {"innings_bowled": 0, "wickets": 0, "bowling_avg": None, "economy": None, "stumpings": 0})

            pid = MARQUEE_ID_MAP.get(name, slugify(name))
            if pid in seen_ids:
                continue
            seen_ids.add(pid)

            display_name = MARQUEE_DISPLAY_NAMES.get(pid, name)

            all_players.append({
                "id":         pid,
                "name":       display_name,
                "is_marquee": name in MARQUEE_ID_MAP,
                "role":       assign_role(name, bat, bowl),
                "_score":     composite_score(bat, bowl),
                "_bat":       bat,
                "_bowl":      bowl,
                "_franchise": franchise,
            })
            nepali_count += 1

        print(f"  Nepali: {nepali_count}  |  Overseas excluded: {sorted(overseas_found)}")

    marquee     = [p for p in all_players if p["is_marquee"]]
    non_marquee = [p for p in all_players if not p["is_marquee"]]

    print(f"\nTotal Nepali: {len(all_players)} ({len(marquee)} marquee, {len(non_marquee)} non-marquee)")

    # Assign categories to non-marquee by score
    non_marquee.sort(key=lambda p: p["_score"], reverse=True)
    n = len(non_marquee)
    a_cut = round(n * 0.25)
    b_cut = round(n * 0.65)

    for i, p in enumerate(non_marquee):
        if i < a_cut:
            p["category"] = "A"; p["base_price"] = 1_000_000
        elif i < b_cut:
            p["category"] = "B"; p["base_price"] =   500_000
        else:
            p["category"] = "C"; p["base_price"] =   200_000

    for p in marquee:
        p["category"] = "A"; p["base_price"] = 1_000_000

    # Build output
    out_players = []
    for p in marquee + non_marquee:
        bat  = p["_bat"]
        bowl = p["_bowl"]
        out_players.append({
            "id":         p["id"],
            "name":       p["name"],
            "category":   p["category"],
            "role":       p["role"],
            "base_price": p["base_price"],
            "is_marquee": p["is_marquee"],
            "stats": {
                "runs":        bat.get("runs", 0),
                "wickets":     bowl.get("wickets", 0),
                "batting_avg": bat.get("batting_avg"),
                "strike_rate": bat.get("strike_rate"),
                "bowling_avg": bowl.get("bowling_avg"),
                "economy":     bowl.get("economy"),
            },
        })

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"season": 2024, "players": out_players}, f, indent=2, ensure_ascii=False)

    # Summary
    cats  = {"A": 0, "B": 0, "C": 0}
    roles = {"BAT": 0, "BOWL": 0, "WK": 0, "AR": 0}
    for p in out_players:
        cats[p["category"]] += 1
        roles[p["role"]] += 1

    print(f"Categories: {cats}")
    print(f"Roles: {roles}")
    print(f"\nWrote {len(out_players)} players → {OUTPUT_FILE}")

    print("\n--- All players (by score, non-marquee only) ---")
    for p in non_marquee:
        bat = p["_bat"]
        bowl = p["_bowl"]
        print(
            f"  {p['category']} | {p['role']:4s} | score={p['_score']:6.0f} | "
            f"runs={bat.get('runs',0):3d} wkts={bowl.get('wickets',0):2d} | "
            f"{p['name']:<28s} | {p['_franchise']}"
        )

if __name__ == "__main__":
    main()
