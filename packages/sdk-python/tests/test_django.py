import django
import pytest
from django.conf import settings

import sentinel_sdk

if not settings.configured:
    settings.configure(
        DEBUG=False,
        SECRET_KEY="test",
        ALLOWED_HOSTS=["*"],
        ROOT_URLCONF="test_django",
        MIDDLEWARE=["sentinel_sdk.integrations.django.SentinelDjangoMiddleware"],
        DEFAULT_CHARSET="utf-8",
    )
    django.setup()

from django.core.handlers.wsgi import WSGIHandler  # noqa: E402
from django.http import Http404, HttpResponse  # noqa: E402
from django.urls import path  # noqa: E402

from test_wsgi import call  # noqa: E402


def user(request, user_id):
    return HttpResponse(f"user {user_id}")


def boom(request):
    raise RuntimeError("django exploded")


def gone(request):
    raise Http404("nope")


urlpatterns = [path("users/<int:user_id>/", user), path("boom/", boom), path("gone/", gone)]


@pytest.fixture
def app():
    from sentinel_sdk import SentinelWsgiMiddleware

    return SentinelWsgiMiddleware(WSGIHandler())


def test_django_transactions_use_the_url_pattern(sdk, app):
    sink = sdk(traces_sample_rate=1.0)
    assert call(app, "/users/42/")[0] == "200 OK"
    assert sink.transactions[0]["name"] == "GET /users/<int:user_id>/"


def test_django_errors_become_a_500_and_are_captured_but_a_404_is_not(sdk, app, caplog):
    sink = sdk(traces_sample_rate=1.0)
    assert call(app, "/boom/")[0].startswith("500")
    assert call(app, "/gone/")[0].startswith("404")
    [event] = sink.events
    assert event["exception"]["values"][-1]["value"] == "django exploded"
    assert event["tags"]["mechanism"] == "django"
    assert [t["status"] for t in sink.transactions] == ["internal_error", "ok"]
    assert event["contexts"]["trace"]["trace_id"] == sink.transactions[0]["trace_id"]
    assert sentinel_sdk.get_client() is not None
