import os
from io import BytesIO
from typing import Optional, Dict

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from google import genai
from PIL import Image


# =========================================================
# 1. GEMINI CONFIGURATION
# =========================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set.")

client = genai.Client(api_key=GEMINI_API_KEY)


# =========================================================
# 2. FASTAPI INITIALIZATION
# =========================================================

app = FastAPI(
    title="Civic Issue Detection API",
    description="AI powered civic complaint classification system",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# 3. CHILD CATEGORY TAXONOMY (1–42 ONLY)
# =========================================================

CHILD_CATEGORIES: Dict[int, Dict] = {

    1: {"name": "Metro Station Issue", "parent": 100, "authority": "DMRC"},
    2: {"name": "Metro Track / Safety", "parent": 100, "authority": "DMRC"},
    3: {"name": "Escalator / Lift", "parent": 100, "authority": "DMRC"},
    4: {"name": "Metro Parking", "parent": 100, "authority": "DMRC"},
    5: {"name": "Metro Station Hygiene", "parent": 100, "authority": "DMRC"},
    6: {"name": "Metro Property Damage", "parent": 100, "authority": "DMRC"},

    7: {"name": "National Highway Damage", "parent": 101, "authority": "NHAI"},
    8: {"name": "Toll Plaza Issue", "parent": 101, "authority": "NHAI"},
    9: {"name": "Expressway Problem", "parent": 101, "authority": "NHAI"},
    10: {"name": "Highway Bridge Damage", "parent": 101, "authority": "NHAI"},

    11: {"name": "State Highway / City Road", "parent": 101, "authority": "PWD"},
    12: {"name": "Flyover / Overbridge", "parent": 101, "authority": "PWD"},
    13: {"name": "Government Building Issue", "parent": 109, "authority": "PWD"},
    14: {"name": "Large Drainage System", "parent": 101, "authority": "PWD"},

    15: {"name": "Colony Road / Lane", "parent": 101, "authority": "MCD"},
    16: {"name": "Garbage Collection", "parent": 104, "authority": "MCD"},
    17: {"name": "Street Sweeping", "parent": 104, "authority": "MCD"},
    18: {"name": "Park Maintenance", "parent": 105, "authority": "MCD"},
    19: {"name": "Public Toilet", "parent": 104, "authority": "MCD"},
    20: {"name": "Local Drain / Sewage", "parent": 102, "authority": "MCD"},
    21: {"name": "Stray Animals", "parent": 104, "authority": "MCD"},
    22: {"name": "Street Light (MCD zone)", "parent": 108, "authority": "MCD"},

    23: {"name": "Connaught Place / Lutyens Issue", "parent": 110, "authority": "NDMC"},
    24: {"name": "NDMC Road / Infrastructure", "parent": 110, "authority": "NDMC"},
    25: {"name": "NDMC Street Light", "parent": 108, "authority": "NDMC"},
    26: {"name": "Central Govt Residential Zone", "parent": 109, "authority": "NDMC"},

    27: {"name": "Water Supply Failure", "parent": 102, "authority": "DJB"},
    28: {"name": "Water Pipe Leakage", "parent": 102, "authority": "DJB"},
    29: {"name": "Sewer Line Blockage", "parent": 102, "authority": "DJB"},
    30: {"name": "Contaminated Water", "parent": 102, "authority": "DJB"},

    31: {"name": "Power Outage", "parent": 103, "authority": "DISCOM"},
    32: {"name": "Transformer Issue", "parent": 103, "authority": "DISCOM"},
    33: {"name": "Exposed / Fallen Wire", "parent": 103, "authority": "DISCOM"},
    34: {"name": "Electricity Pole Damage", "parent": 103, "authority": "DISCOM"},

    35: {"name": "Crime / Safety Issue", "parent": 106, "authority": "DELHI_POLICE"},
    36: {"name": "Traffic Signal Problem", "parent": 106, "authority": "TRAFFIC_POLICE"},
    37: {"name": "Illegal Parking", "parent": 106, "authority": "TRAFFIC_POLICE"},
    38: {"name": "Road Accident Black Spot", "parent": 106, "authority": "TRAFFIC_POLICE"},

    39: {"name": "Illegal Tree Cutting", "parent": 107, "authority": "FOREST_DEPT"},
    40: {"name": "Air Pollution / Burning", "parent": 107, "authority": "DPCC"},
    41: {"name": "Noise Pollution", "parent": 107, "authority": "DPCC"},
    42: {"name": "Industrial Waste Dumping", "parent": 107, "authority": "DPCC"},
}


# =========================================================
# 4. RESPONSE MODEL
# =========================================================

class TicketPreview(BaseModel):
    issue_name: str
    child_id: int
    parent_id: int
    authority: str
    latitude: float
    longitude: float
    user_text: Optional[str]


# =========================================================
# 5. GEMINI CLASSIFICATION FUNCTION
# =========================================================

def classify_issue(image: Image.Image, text: str, latitude: float, longitude: float) -> int:

    prompt = f"""
You are a strict civic issue classifier for a Delhi government complaint platform.

TASK: Look at the image carefully and return ONLY a single integer — the Child ID that best matches the issue visible in the image.

DEVICE LOCATION (use this to resolve zone-based ambiguity, e.g. MCD vs NDMC areas):
Latitude: {latitude}
Longitude: {longitude}

LOCATION GUIDANCE:
- Coordinates near Connaught Place / Lutyens zone (approx 28.62–28.64 N, 77.19–77.23 E) → prefer NDMC categories (23, 24, 25, 26)
- All other Delhi areas → prefer MCD categories (15–22) unless image clearly shows NDMC infrastructure

USER DESCRIPTION (use as supporting context, image is primary):
{text}

COMPLETE CATEGORY LIST — pick the single best match:
1  = Metro Station Issue
2  = Metro Track / Safety
3  = Escalator / Lift
4  = Metro Parking
5  = Metro Station Hygiene
6  = Metro Property Damage
7  = National Highway Damage
8  = Toll Plaza Issue
9  = Expressway Problem
10 = Highway Bridge Damage
11 = State Highway / City Road
12 = Flyover / Overbridge
13 = Government Building Issue
14 = Large Drainage System
15 = Colony Road / Lane
16 = Garbage Collection
17 = Street Sweeping
18 = Park Maintenance
19 = Public Toilet
20 = Local Drain / Sewage
21 = Stray Animals
22 = Street Light (MCD zone)
23 = Connaught Place / Lutyens Issue
24 = NDMC Road / Infrastructure
25 = NDMC Street Light
26 = Central Govt Residential Zone
27 = Water Supply Failure
28 = Water Pipe Leakage
29 = Sewer Line Blockage
30 = Contaminated Water
31 = Power Outage
32 = Transformer Issue
33 = Exposed / Fallen Wire
34 = Electricity Pole Damage
35 = Crime / Safety Issue
36 = Traffic Signal Problem
37 = Illegal Parking
38 = Road Accident Black Spot
39 = Illegal Tree Cutting
40 = Air Pollution / Burning
41 = Noise Pollution
42 = Industrial Waste Dumping

STRICT RULES:
- Return ONLY a single integer from 1 to 42. No explanation, no text, no punctuation.
- If the image is NOT a civic infrastructure issue (e.g. selfie, food, animal, indoor scene), return: INVALID
- Never guess randomly. If unsure between two IDs, use the location coordinates and user description to decide.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[prompt, image],
        config={"temperature": 0},
    )

    result = response.text.strip()

    if result == "INVALID":
        raise HTTPException(
            status_code=400,
            detail="This assistant can only be used to report civic infrastructure issues."
        )

    try:
        child_id = int(result)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail=f"Model returned invalid classification: '{result}'"
        )

    if child_id not in CHILD_CATEGORIES:
        raise HTTPException(
            status_code=500,
            detail=f"Model predicted an out-of-range child ID: {child_id}"
        )

    return child_id


# =========================================================
# 6. ANALYZE ENDPOINT
# =========================================================

@app.post("/analyze", response_model=TicketPreview)
async def analyze_issue(
    image: UploadFile = File(...),
    user_text: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...)
):
    # Read bytes first, then wrap in BytesIO so PIL can open it
    image_data = await image.read()
    img = Image.open(BytesIO(image_data))

    child_id = classify_issue(img, user_text, latitude, longitude)

    category = CHILD_CATEGORIES[child_id]

    return TicketPreview(
        issue_name=category["name"],
        child_id=child_id,
        parent_id=category["parent"],
        authority=category["authority"],
        latitude=latitude,
        longitude=longitude,
        user_text=user_text
    )


# =========================================================
# 7. ROOT MESSAGE
# =========================================================

@app.get("/")
def home():
    return {
        "assistant":
        "Welcome to the Civic Issue Reporting Assistant. "
        "To report an issue, please attach an image of the civic problem. "
        "You may optionally provide a short description."
    }