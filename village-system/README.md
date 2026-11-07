# SmartGram

A responsive Gram Panchayat services portal built with **HTML5, CSS3 and JavaScript**, **Python/Flask**, and **SQLite**, following the supplied SmartGram project overview. The application imports all 5,949 supplied Karnataka Gram Panchayat records on first start.

## Run locally

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
py app.py
```

Open http://127.0.0.1:5000. The SQLite database is created at `instance\smartgram.db`.

The supplied source data is `data\karnataka_gram_panchayats.csv`. Set `SMARTGRAM_PANCHAYAT_CSV` to use another file. `SMARTGRAM_DATABASE` changes the database path.

## Demo accounts

On an empty database, the app creates these local demonstration users (password: `SmartGram@123`):

| Role | Email |
|---|---|
| Citizen | citizen@smartgram.local |
| Panchayat officer | officer@smartgram.local |
| Administrator | admin@smartgram.local |

Change demo passwords and set a unique `SMARTGRAM_SECRET_KEY` before exposing the app to a network. Citizen registration is open; officer accounts are created by an administrator.

## Features

- Role-aware citizen, officer, and administrator views; officers are restricted to their assigned Panchayat.
- Citizen registration, complaint submission with optional problem photos and an interactive map pin/current-location option, status tracking, and update history. Photos are restricted to JPG, PNG, GIF or WebP up to 5 MB and are visible only to the reporting citizen and authorized Panchayat staff.
- Village / School / Health classification, with an editable browser speech-to-text option and an optional AI API classifier.
- OpenStreetMap-backed issue map (Leaflet); coordinates are optional.
- Public budget allocations and expenditure; school facilities and meal feedback; development projects and inspection evidence/feedback.
- Health camp publishing with officer-defined appointment hours, duration and per-slot capacity; citizens can get an AI-assisted availability recommendation and confirm a reserved check-up time. Recommendations are advisory, with a queue-aware fallback when no AI API is configured.
- Officers can publish local scheme guidance scoped to their assigned Gram Panchayat; administrators can publish for any Panchayat. Residents can review eligibility guidance, application details and optional official links.
- General scheme information based on a small, non-sensitive profile. This is not an official eligibility decision.
- Village issue reports that group active complaints by village and issue, flag repeated problems by priority, and recommend officer follow-up; optional AI analyzes complaint descriptions, with a local analysis fallback.
- Admin reports, Panchayat/officer management, and in-app notifications.

## Optional AI integration

Without credentials, complaint categorization uses a local keyword helper and development priorities use complaint counts. To enable AI-assisted output, set `OPENAI_API_KEY`; optional `OPENAI_API_URL` and `OPENAI_MODEL` variables support a compatible chat-completions endpoint/model. AI suggestions are advisory and must be reviewed by an officer. Maps and speech recognition use browser-accessible services and require network/browser support.

Public transparency records are only shown after an authorized officer or administrator publishes them; no sample financial or service data is fabricated.
