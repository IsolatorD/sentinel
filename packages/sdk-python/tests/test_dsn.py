import pytest

from sentinel_sdk.dsn import parse_dsn
from conftest import DSN, KEY, PROJECT


def test_extracts_key_project_and_urls():
    dsn = parse_dsn(DSN)
    assert dsn is not None
    assert dsn.public_key == KEY
    assert dsn.project_id == PROJECT
    assert dsn.events_url == f"https://sentinel.example.com/api/{PROJECT}/events"
    assert dsn.transactions_url == f"https://sentinel.example.com/api/{PROJECT}/transactions"
    assert dsn.own_base == f"https://sentinel.example.com/api/{PROJECT}/"


def test_keeps_port_and_path_prefix_behind_a_proxy():
    assert parse_dsn(f"http://{KEY}@localhost:3000/{PROJECT}").events_url == f"http://localhost:3000/api/{PROJECT}/events"
    assert parse_dsn(f"https://{KEY}@example.com/sentinel/{PROJECT}").events_url == f"https://example.com/sentinel/api/{PROJECT}/events"


def test_normalizes_the_key_to_lowercase():
    assert parse_dsn(f"https://{KEY.upper()}@h.com/{PROJECT}").public_key == KEY


@pytest.mark.parametrize(
    "bad",
    [None, 42, "", "nope", f"ftp://{KEY}@h.com/{PROJECT}", f"https://h.com/{PROJECT}", f"https://short@h.com/{PROJECT}", f"https://{KEY}@h.com/not-a-uuid", f"https://{KEY}@h.com/"],
)
def test_invalid_dsn_is_none(bad):
    assert parse_dsn(bad) is None
