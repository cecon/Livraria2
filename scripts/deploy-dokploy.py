"""Request a Cloud deployment after all images have been published."""
import json
import os
import re
import urllib.request


def main():
    base = os.environ["DOKPLOY_URL"].rstrip("/")
    key = os.environ["DOKPLOY_API_KEY"]
    compose_id = os.environ["DOKPLOY_COMPOSE_ID"]
    revision = os.environ["GITHUB_SHA"]
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("Invalid image revision")

    def api(path, body=None):
        request = urllib.request.Request(
            base + "/api/" + path,
            data=None if body is None else json.dumps(body).encode(),
            headers={"x-api-key": key, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)

    current = api("compose.one?composeId=" + compose_id)
    lines = (current.get("env") or "").splitlines()
    lines = [line for line in lines if not line.startswith("CLOUD_VERSION=")]
    lines.append("CLOUD_VERSION=" + revision)
    api("compose.saveEnvironment", {"composeId": compose_id, "env": "\n".join(lines)})
    api("compose.deploy", {"composeId": compose_id, "title": "Cloud " + revision})
    print("Deployment requested for " + revision + "; check execution in Dokploy.")


if __name__ == "__main__":
    main()
