"""Set a confirmed Render URL in the distributable Chrome extension."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

def configure(server_url: str, extension_dir: Path) -> str:
    parsed = urlsplit(server_url.strip())
    if (parsed.scheme != "https" or not parsed.hostname
            or not re.fullmatch(r"[a-z0-9.-]+\.onrender\.com", parsed.hostname)
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in {"", "/"} or parsed.port):
        raise ValueError("Provide the actual HTTPS origin of the deployed Render service.")
    origin = "https://" + parsed.hostname
    manifest_path = extension_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    hosts = [
        item for item in manifest.get("host_permissions", [])
        if not (item.startswith("https://") and ".onrender.com" in item)
    ]
    hosts.append(origin + "/*")
    manifest["host_permissions"] = hosts
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (extension_dir/"config.js").write_text(
        "// Public service URL; API credentials are stored only on the server.\n"
        + "export const DEFAULT_SERVER_URL = " + json.dumps(origin) + ";\n",
        encoding="utf-8",
    )
    return origin

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--server-url",required=True)
    parser.add_argument("--extension-dir",type=Path,default=Path(__file__).resolve().parents[1]/"extension")
    args=parser.parse_args()
    print(configure(args.server_url,args.extension_dir))
