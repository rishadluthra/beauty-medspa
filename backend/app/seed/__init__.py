"""One-time seed data loading.

Contains the migration script that loads the client's static JSON fixtures
(`seed_data/*.json`) into PostgreSQL. Not imported or used by the running
application — see `load_seed_data.py` for details.
"""
