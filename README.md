# MyLuffatriAI

A self-hosted, multi-character AI chat app: sign up, pick a character, chat, and come
back later to the same conversation. Built with FastAPI + SQLite on the backend and
plain HTML/CSS/JS on the frontend (no build step).

Tested end-to-end while building this: signup/login, JWT auth, character creation,
sending messages, and chat history persistence all work. The default `AI_PROVIDER=mock`
setting means you can run and click through the entire app **before** wiring up any AI
API key.

## 1. Run the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

The API is now at `http://localhost:8000` (interactive docs at `/docs`). On first run
it creates `database.db` (SQLite) and seeds 8 starter characters automatically.

With `.env` untouched (`AI_PROVIDER=mock`), chatting with any character returns a
canned placeholder reply so you can test the whole flow with zero setup.

## 2. Turn on real AI replies

1. Get a free Gemini key at **https://aistudio.google.com** (~1,500 requests/day free).
2. In `backend/.env`, set:
   ```
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your_key_here
   ```
3. Restart `uvicorn`.

Optional: get a free key at **https://console.groq.com** and set `AI_PROVIDER=groq` /
`GROQ_API_KEY` as a fallback if you hit Gemini's daily limit — `ai_service.py` is
written so it's a one-line swap between providers, no other code changes needed.

## 3. Run the frontend

No build step — it's static files. Simplest option:

```bash
cd frontend
python3 -m http.server 5500
```

Then open `http://localhost:5500/login.html`. If your backend isn't at
`localhost:8000`, set `window.API_BASE_URL` before the other scripts load — add this
line right before the `<script src="js/api.js">` tag on each page:

```html
<script>window.API_BASE_URL = "https://your-backend-domain.com";</script>
```

## Project structure

```
backend/
  main.py          - all API routes
  database.py      - SQLAlchemy models (User, Character, Chat, Message)
  auth.py          - password hashing + JWT
  ai_service.py     - pluggable AI backend: gemini | groq | mock
  seed_data.py     - the 8 default characters
  schemas.py       - request/response validation
  requirements.txt
  .env.example
frontend/
  login.html, index.html, chat.html, create-character.html
  css/style.css    - shared design system
  js/api.js        - fetch wrapper + token storage
  js/common.js     - shared UI helpers (the dial-avatar component)
  js/auth.js, home.js, chat.js, create.js  - one file per page
```

## API reference

| Method | Route                          | Auth? | What it does |
|--------|---------------------------------|-------|---------------|
| POST   | `/api/signup`                   | No    | Create account, returns JWT |
| POST   | `/api/login`                    | No    | Returns JWT |
| GET    | `/api/me`                       | Yes   | Current user info |
| GET    | `/api/characters`               | No    | List public characters |
| POST   | `/api/characters`               | Yes   | Create a character |
| GET    | `/api/characters/{id}`          | No    | Get one character |
| GET    | `/api/chats`                    | Yes   | List your chat sessions |
| GET    | `/api/chats/{character_id}/messages` | Yes | Full history with one character |
| POST   | `/api/chat`                     | Yes   | Send a message, get the AI's reply |

## Before you deploy this publicly

This is a solid working starting point, not a hardened production app. Before opening
it up to real users:

- **Set a real `SECRET_KEY`** (the `.env.example` has a generator command). Never ship
  the dev default.
- **Lock down `CORS_ORIGINS`** to your actual frontend domain instead of `*`.
- **Rate-limit `/api/chat` and `/api/signup`** — nothing currently stops one user from
  spamming your AI quota or creating thousands of accounts. `slowapi` is a quick add.
- **Add content moderation** for user-created characters and messages if the site is
  open to the public — an unmoderated "create your own character" feature is one of
  the first things people will try to abuse.
- **Switch to Postgres/MySQL** once you're past a handful of concurrent users; SQLite
  will start to struggle with write concurrency.
- **The seed characters are original, not copies of copyrighted IP** (no Marvel,
  anime, or other franchise characters) — worth keeping it that way if the site is
  public, since Character.AI itself has faced lawsuits over user-created characters
  based on real people and copyrighted characters.
- If you keep something like the "Luna" companion/listener character, keep the
  in-prompt disclaimer that it isn't a licensed therapist and shouldn't replace real
  mental health care.

## Cost to run

Same shape as the original plan: $0 to start. SQLite + FastAPI on a free Render/Railway
tier + Gemini's free tier covers roughly the first few hundred users; the main things
that start costing money as you grow are AI request volume and server uptime (see the
deploy checklist above for where to add guardrails before that happens).
