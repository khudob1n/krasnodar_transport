#!/usr/bin/env python3
"""
Собирает client/public/map-style-{light,dark}.json - стиль подложки карты.

Тайлы - OpenFreeMap (tiles.openfreemap.org, OSM по схеме OpenMapTiles, бесплатно, без ключа,
весь мир). Их готовые стили (Positron, Dark) выглядят совсем иначе, чем карта Екатеринбурга
(map.ekaterinburg.city), поэтому стиль собран здесь заново: те же слои, в том же порядке,
с теми же цветами, толщинами линий и шрифтом, что в ekaterinburg_transport
(passenger/client/public/ekb-map-style-*.json), только фильтры переписаны под поля
OpenMapTiles. Id слоёв сохранены - на них ссылается упрощённая подложка
(SIMPLE_HIDDEN_LAYERS в components/Map/MainContainer/MapVectorBasemap.tsx).

Запуск: python3 tools/build-map-style.py (из passenger/). Для админки (admin/web/public)
пишется копия светлой темы.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIRS = [ROOT / "client" / "public"]
ADMIN_PUBLIC = ROOT.parent / "admin" / "web" / "public"

THEMES = {
    "dark": {
        "background": "#010508",
        "wood": "#001e0a",
        "grassland": "#001e0a",
        "leisure": "#001e0a",
        "landuse_overlay": "#001e0a",
        "water": "#083245",
        "road": "#171930",
        "path": "#171930",
        "rail": "#171930",
        "bridge_outline": "#171930",
        "bridge": "#171930",
        "road_label": "rgba(255, 255, 255, .3)",
        "road_label_halo": "rgba(0, 0, 0, 0.8)",
        "water_label": "rgba(10, 120, 160, 1)",
        "water_label_halo": "rgba(0, 0, 0, 0)",
        "building": "#0c1021",
        "housenumber": "rgba(255, 255, 255, 0.1)",
        "housenumber_halo": "rgba(0,0,0,0.8)",
    },
    "light": {
        "background": "#f7f7f5",
        "wood": "#d7e8d2",
        "grassland": "#e1efdb",
        "leisure": "#dcefda",
        "landuse_overlay": "#e7e6e0",
        "water": "#c7e2f2",
        "road": "#dcdcd6",
        "path": "#b9b9b2",
        "rail": "#b3b0c2",
        "bridge_outline": "#c7c7c0",
        "bridge": "#e7e7e2",
        "road_label": "rgba(60, 60, 56, 0.85)",
        "road_label_halo": "rgba(255, 255, 255, 0.9)",
        "water_label": "rgba(40, 100, 145, 1)",
        "water_label_halo": "rgba(255, 255, 255, 0.85)",
        "building": "#e6e3db",
        "housenumber": "rgba(70, 68, 60, 0.55)",
        "housenumber_halo": "rgba(255,255,255,0.85)",
    },
}

FONT = ["JetBrains Mono Regular"]
NAME = ["coalesce", ["get", "name:ru"], ["get", "name"]]


def by_zoom(width_at_20):
    """Толщина как у Екатеринбурга: 0.2 на z5, до width_at_20 на z20, экспонента 1.2."""
    return ["interpolate", ["exponential", 1.2], ["zoom"], 5, 0.2, 20, width_at_20]


def match_class(widths, default):
    """Толщина по классу дороги OpenMapTiles."""
    expr = ["match", ["get", "class"]]
    for cls, width in widths.items():
        expr += [cls, width]
    return expr + [default]


# highway=* Екатеринбурга -> class OpenMapTiles: residential/unclassified/living_street
# там все minor, *_link - тот же класс с ramp=1, pedestrian - class path, subclass pedestrian.
ROAD_CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "raceway"]
ROAD_WIDTH = {"motorway": 12, "trunk": 8, "primary": 20, "secondary": 12, "tertiary": 8, "minor": 2, "service": 2, "raceway": 2}
BRIDGE_WIDTH = {"motorway": 12, "trunk": 8, "primary": 10, "secondary": 8, "tertiary": 8, "minor": 4, "service": 4, "raceway": 4, "track": 2}
PEDESTRIAN = ["all", ["==", ["get", "class"], "path"], ["==", ["get", "subclass"], "pedestrian"]]
ROAD = ["any", ["in", ["get", "class"], ["literal", ROAD_CLASSES]], PEDESTRIAN]
NOT_BRIDGE_TUNNEL = ["!", ["in", ["coalesce", ["get", "brunnel"], ""], ["literal", ["bridge", "tunnel"]]]]


def style(theme):
    c = THEMES[theme]
    layers = [
        {"id": "background", "type": "background", "paint": {"background-color": c["background"]}},
        {
            # Леса и луга (natural=wood/grassland/heath/scrub).
            "id": "natural",
            "type": "fill",
            "source": "openmaptiles",
            "source-layer": "landcover",
            "filter": ["in", ["get", "subclass"], ["literal", ["wood", "grassland", "heath", "scrub", "wetland", "beach", "sand"]]],
            "paint": {"fill-color": ["match", ["get", "subclass"], "wood", c["wood"], c["grassland"]]},
        },
        {
            # Парки, скверы, спортплощадки.
            "id": "leisure",
            "type": "fill",
            "source": "openmaptiles",
            "source-layer": "landuse",
            "filter": ["in", ["get", "class"], ["literal", ["pitch", "playground", "stadium", "track", "garden", "golf_course", "park"]]],
            "paint": {"fill-color": c["leisure"]},
        },
        {
            "id": "leisure_park",
            "type": "fill",
            "source": "openmaptiles",
            "source-layer": "park",
            "paint": {"fill-color": c["leisure"]},
        },
        {
            # landuse=grass/forest/orchard...
            "id": "landuse_overlay",
            "type": "fill",
            "source": "openmaptiles",
            "source-layer": "landcover",
            "filter": ["in", ["get", "subclass"], ["literal", ["grass", "forest", "orchard", "vineyard", "meadow", "village_green", "recreation_ground", "greenhouse_horticulture"]]],
            "paint": {"fill-color": c["landuse_overlay"]},
        },
        {
            "id": "natural_overlay",
            "type": "fill",
            "source": "openmaptiles",
            "source-layer": "water",
            "filter": ["!=", ["get", "brunnel"], "tunnel"],
            "paint": {"fill-color": c["water"]},
        },
        {
            "id": "waterway",
            "type": "line",
            "source": "openmaptiles",
            "source-layer": "waterway",
            "filter": ["!=", ["get", "brunnel"], "tunnel"],
            "paint": {"line-color": c["water"], "line-width": ["interpolate", ["exponential", 1.2], ["zoom"], 4, 0, 20, 12]},
        },
        {
            "id": "highway_line",
            "type": "line",
            "source": "openmaptiles",
            "source-layer": "transportation",
            "filter": ["all", ROAD, NOT_BRIDGE_TUNNEL],
            "layout": {"line-cap": "round", "line-join": "round"},
            "paint": {"line-color": c["road"], "line-width": by_zoom(match_class(ROAD_WIDTH, 2))},
        },
        {
            # Тротуары, тропинки, велодорожки, лестницы, грунтовки - пунктиром.
            "id": "highway_dash",
            "type": "line",
            "source": "openmaptiles",
            "source-layer": "transportation",
            "filter": ["all", ["in", ["get", "class"], ["literal", ["path", "track", "bridleway"]]], ["!", PEDESTRIAN], NOT_BRIDGE_TUNNEL],
            "layout": {"line-cap": "round", "line-join": "round"},
            "paint": {"line-color": c["path"], "line-width": by_zoom(1), "line-dasharray": [2, 2], "line-opacity": 0.5},
        },
        {
            # Железная дорога и трамвайные пути (class transit) - точками.
            "id": "railway_line",
            "type": "line",
            "source": "openmaptiles",
            "source-layer": "transportation",
            "filter": ["all", ["in", ["get", "class"], ["literal", ["rail", "transit"]]], ["!=", ["get", "brunnel"], "tunnel"]],
            "layout": {"line-cap": "round", "line-join": "round"},
            "paint": {
                "line-color": c["rail"],
                "line-width": by_zoom(["case", ["all", ["==", ["get", "class"], "rail"], ["!", ["has", "service"]]], 10, 6]),
                "line-dasharray": [0.1, 2],
            },
        },
        {
            "id": "bridge_outline",
            "type": "line",
            "source": "openmaptiles",
            "source-layer": "transportation",
            "filter": ["all", ["==", ["get", "brunnel"], "bridge"], ROAD],
            "layout": {"line-cap": "butt", "line-join": "miter"},
            "paint": {
                "line-color": c["bridge_outline"],
                "line-width": by_zoom(2),
                "line-gap-width": by_zoom(match_class(BRIDGE_WIDTH, 2)),
            },
        },
        {
            "id": "bridge_line",
            "type": "line",
            "source": "openmaptiles",
            "source-layer": "transportation",
            "filter": ["all", ["==", ["get", "brunnel"], "bridge"], ["any", ROAD, ["==", ["get", "class"], "track"]]],
            "layout": {"line-cap": "butt", "line-join": "miter"},
            "paint": {"line-color": c["bridge"], "line-width": by_zoom(match_class(BRIDGE_WIDTH, 2))},
        },
        {
            "id": "highway_label",
            "type": "symbol",
            "source": "openmaptiles",
            "source-layer": "transportation_name",
            "layout": {
                "symbol-placement": "line",
                "text-anchor": "center",
                "text-field": NAME,
                "text-font": FONT,
                "text-size": ["interpolate", ["exponential", 1], ["zoom"], 13, 10, 14, 12],
                "text-transform": "uppercase",
                "text-letter-spacing": 0.1,
            },
            "paint": {"text-color": c["road_label"], "text-halo-color": c["road_label_halo"], "text-halo-width": 1},
        },
        {
            "id": "waterway_label",
            "type": "symbol",
            "source": "openmaptiles",
            "source-layer": "waterway",
            "minzoom": 12,
            "filter": ["==", ["get", "class"], "river"],
            "layout": {
                "text-font": FONT,
                "text-field": NAME,
                "text-size": ["interpolate", ["exponential", 1.2], ["zoom"], 12, 9, 15, 12, 18, 11],
                "symbol-placement": "line",
                "text-letter-spacing": 0.2,
                "text-transform": "uppercase",
            },
            "paint": {"text-color": c["water_label"], "text-halo-color": c["water_label_halo"], "text-halo-width": 1},
        },
        {
            "id": "building",
            "type": "fill",
            "source": "openmaptiles",
            "source-layer": "building",
            "paint": {"fill-color": c["building"], "fill-opacity": 0.9},
        },
        {
            "id": "building_number",
            "type": "symbol",
            "source": "openmaptiles",
            "source-layer": "housenumber",
            "layout": {
                "text-allow-overlap": False,
                "text-anchor": "center",
                "text-field": ["get", "housenumber"],
                "text-font": FONT,
                "text-size": ["interpolate", ["exponential", 1], ["zoom"], 15, 0, 16, 11, 20, 11],
            },
            "paint": {
                "text-color": c["housenumber"],
                "text-halo-color": c["housenumber_halo"],
                "text-halo-width": 0,
                "text-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0, 15, 1],
            },
        },
    ]
    return {
        "version": 8,
        "name": f"krasnodar-{theme} (OpenFreeMap tiles, look of map.ekaterinburg.city)",
        "sources": {"openmaptiles": {"type": "vector", "url": "https://tiles.openfreemap.org/planet"}},
        "glyphs": "/fonts/{fontstack}/{range}.pbf",
        "layers": layers,
    }


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("->", path)


for theme in THEMES:
    for out in OUT_DIRS:
        write(out / f"map-style-{theme}.json", style(theme))

# Админке глифы JetBrains Mono не положены - берёт их у OpenFreeMap под тем же именем нельзя,
# поэтому там шрифт Noto Sans с их хостинга.
admin = style("light")
admin["glyphs"] = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf"
for layer in admin["layers"]:
    if "text-font" in layer.get("layout", {}):
        layer["layout"]["text-font"] = ["Noto Sans Regular"]
write(ADMIN_PUBLIC / "map-style-light.json", admin)
(ADMIN_PUBLIC / "map-style-dark.json").unlink(missing_ok=True)
