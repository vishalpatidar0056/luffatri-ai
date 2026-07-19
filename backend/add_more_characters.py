"""
add_more_characters.py - one-time helper for databases that were already
seeded before new entries were added to seed_data.py.

Safe to run more than once: it checks each character by name and only
inserts the ones that don't already exist, so it won't create duplicates.

Usage (from backend/, with your venv active and .env configured):
    python add_more_characters.py
"""
from dotenv import load_dotenv
load_dotenv()

from database import SessionLocal, init_db, Character
from seed_data import DEFAULT_CHARACTERS

init_db()
db = SessionLocal()
try:
    existing_names = {name for (name,) in db.query(Character.name).all()}
    added = 0
    for c in DEFAULT_CHARACTERS:
        if c["name"] not in existing_names:
            db.add(Character(**c, created_by=None, is_public=True))
            added += 1
            print(f"Adding: {c['name']}")
    db.commit()
    print(f"\nDone - added {added} new character(s). "
          f"({len(DEFAULT_CHARACTERS) - added} already existed and were skipped.)")
finally:
    db.close()
