# SmartGram

A responsive Gram Panchayat services portal built with **HTML5, CSS3 and JavaScript**, **Python/Flask**, and **SQLAlchemy**. Development defaults to SQLite; production requires PostgreSQL. The application imports all 5,949 supplied Karnataka Gram Panchayat records on first local start.

## Run locally

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
py app.py
```

Open http://127.0.0.1:5000. The SQLite database is created at `instance\smartgram.db`.

The supplied source data is `data\karnataka_gram_panchayats.csv`. Set `SMARTGRAM_PANCHAYAT_CSV` to use another file. `SMARTGRAM_DATABASE` changes the database path.

## Database environments and migrations

Set `SMARTGRAM_ENV` to `development` (default), `testing`, or `production`. Local development keeps the existing SQLite database. Production requires `DATABASE_URL` with a PostgreSQL connection string and a unique `SMARTGRAM_SECRET_KEY`; production startup fails if either is missing. Do not put database credentials in source control.

Apply the versioned schema and load Panchayat reference data in a new PostgreSQL database:

```powershell
$env:SMARTGRAM_ENV = "production"
$env:DATABASE_URL = "postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE"
$env:SMARTGRAM_SECRET_KEY = "<deployment-generated-secret>"
python -m flask --app app db upgrade
python -m flask --app app seed-reference-data
```

For an explicitly approved migration of existing local records, first back up the SQLite file and run the schema migration against an empty PostgreSQL database. Do not seed reference data first; the importer copies Panchayat records from SQLite.

```powershell
python -m flask --app app import-sqlite .\instance\smartgram.db
```

The importer preserves primary keys, checks that the target is empty, inserts within a transaction, and updates PostgreSQL ID sequences. It never replaces or modifies the SQLite source. Validate imported row counts and application behavior before switching users to PostgreSQL. PostgreSQL service connectivity and restore procedures must be verified in the target deployment environment.

## Demo accounts

On an empty database, the app creates these local demonstration users (password: `SmartGram@123`):

| Role | Email |
|---|---|
| Citizen | citizen@smartgram.local |
| Panchayat officer | officer@smartgram.local |
| Administrator | admin@smartgram.local |

Change demo passwords and set a unique `SMARTGRAM_SECRET_KEY` before exposing the app to a network. Citizen registration is open; officer accounts are created by an administrator.

## Features

- Shared responsive visual theme across citizen, officer, administration, scheme, health, school and complaint modules: forest-green gradient headers, green actions, light green-tinted background, white rounded cards, subtle shadows and Arial typography.
- Role-aware citizen, officer, and administrator views; officers are restricted to their assigned Panchayat.
- Officers can send announcements to citizen accounts in their assigned Gram Panchayat and review recent notices; recipients see notices in their existing citizen notification feed.
- Citizen registration, complaint submission with optional problem photos and an interactive map pin/current-location option, and live tracking with a unique complaint ID, received/assigned/work-in-progress/resolved milestones, officer assignment, update history, and citizen feedback after resolution. A sole Panchayat officer is assigned automatically; where multiple officers serve the Panchayat, staff can select the assignee. Photos are restricted to JPG, PNG, GIF or WebP up to 5 MB and are visible only to the reporting citizen and authorized Panchayat staff.
- Citizens can rate completed development work, privately share ratings/comments about local government services, and reopen their own resolved complaints when an issue remains unresolved. The public satisfaction page shows anonymous aggregate ratings; written feedback is visible only to the submitting citizen and authorized Panchayat staff.
- Citizen voice assistant for English or Kannada complaint dictation and questions about verified local schemes. Responses can be read aloud using browser speech; Kannada answers require the optional AI service and Kannada speech recognition/voice support depends on the browser and device. Speech transcription uses the browser speech service; SmartGram does not store audio.
- Optional AI photo analysis can suggest a visible road pothole/crack, garbage accumulation, damaged streetlight, drainage issue, or water leakage, plus a complaint category and draft text. Citizens review/apply suggestions before submitting; the result is advisory and officers must verify it. Photo analysis requires a vision-capable configured model and `OPENAI_API_KEY`; uploaded images are sent to the configured AI endpoint only when the citizen explicitly requests analysis.
- Village / School / Health classification, with an editable browser speech-to-text option and an optional AI API classifier.
- OpenStreetMap-backed issue map (Leaflet); coordinates are optional.
- Public budget allocations and expenditure; school facilities and meal feedback; development projects and inspection evidence/feedback.
- Health camp publishing with officer-defined appointment hours, duration and per-slot capacity; citizens can get an AI-assisted availability recommendation and confirm a reserved check-up time. Recommendations are advisory, with a queue-aware fallback when no AI API is configured.
- Officers can add and edit local scheme information for their assigned Gram Panchayat; administrators can manage schemes across Panchayats. Staff verification is required before residents can see a local scheme, and edits clear the verification mark.
- Scheme Guide search by category (education, agriculture, housing, health, employment, water and other), preliminary matching against optional officer-entered age/income limits, personalized potential recommendations, side-by-side comparison, and interactive document checklists.
- A scheme assistant can explain verified local scheme records in simple language when the optional AI service is configured; otherwise it presents a clearly labeled plain-language summary. Guidance is advisory and not an official eligibility decision.
- Previous eligibility checks are tied to the signed-in account; history stores only age/income bands, category and scheme-result labels. Citizens can clear their own history.
- Village issue reports that group active complaints by village and issue, flag repeated problems by priority, and recommend officer follow-up; optional AI analyzes complaint descriptions, with a local analysis fallback.
- Officer-only SmartGram AI Intelligence Dashboard scoped to the signed-in officer's Gram Panchayat, with six-month complaint trends, category and unresolved counts, officer-triggered analysis of uploaded complaint photos, advisory development recommendations, and links to update open complaints. Photo findings are saved for follow-up; a photo is sent to the configured AI service only when an officer requests analysis.
- Admin reports, Panchayat/officer management, and in-app notifications.

## Optional AI integration

Without credentials, complaint categorization uses a local keyword helper and development priorities use complaint counts. To enable AI-assisted output and Kannada scheme explanations, set `OPENAI_API_KEY`; optional `OPENAI_API_URL` and `OPENAI_MODEL` variables support a compatible chat-completions endpoint/model. For image analysis, the selected model and endpoint must also support image inputs. AI suggestions are advisory and must be reviewed by an officer. Maps, speech recognition and spoken playback use browser/device services and require network, microphone permission, and language voice support.

Public transparency records are only shown after an authorized officer or administrator publishes them; no sample financial or service data is fabricated.
