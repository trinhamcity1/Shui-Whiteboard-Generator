import json
import base64
import io
import urllib.request
from PIL import Image

ROOT = "/home/user/Shui-Whiteboard-Generator"

def load(path):
    with open(f"{ROOT}/{path}") as f:
        return json.load(f)

def thumb_data_uri(url, max_dim=260, quality=72):
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            raw = resp.read()
        im = Image.open(io.BytesIO(raw)).convert("RGBA")
        # Composite onto white so a transparent cutout doesn't render black in a plain <img>.
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im).convert("RGB")
        im.thumbnail((max_dim, max_dim), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=quality)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"
    except Exception as e:
        return None

v1 = load("style-model-candidates/v1-library-registry.json")
auto = load("style-model-candidates/auto-expanded-registry.json")

out = {"v1": [], "auto": []}

for entry in v1:
    uri = thumb_data_uri(entry["imageUrl"])
    if not uri:
        continue
    out["v1"].append({
        "id": entry["id"],
        "role": entry.get("role", ""),
        "description": entry.get("description", ""),
        "img": uri,
    })
    print("v1:", entry["id"], "ok" if uri else "FAILED")

for entry in auto:
    uri = thumb_data_uri(entry["imageUrl"])
    if not uri:
        continue
    out["auto"].append({
        "id": entry["id"],
        "role": entry.get("role", ""),
        "description": entry.get("description", ""),
        "status": entry.get("quarantineStatus", "pending"),
        "img": uri,
    })
    print("auto:", entry["id"], entry.get("quarantineStatus"))

with open("/tmp/asset-gallery-data.json", "w") as f:
    json.dump(out, f)

print(f"\nDone. v1={len(out['v1'])} auto={len(out['auto'])}")
