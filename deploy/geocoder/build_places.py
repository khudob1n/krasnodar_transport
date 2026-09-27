#!/usr/bin/env python3
"""Индекс мест для своего геокодера (server/src/geocoder.js) из выгрузки OSM.

Вход - GeoJSON-последовательность от `osmium export` (см. update-geocoder.sh), выход -
data/geocoder/places.json: {"version", "built", "rows": [[kind, title, subtitle, lat, lng], ...]}
    kind: "a" - адрес (дом), "p" - заведение или объект с названием, "s" - улица, "l" - район/посёлок.

Запуск: python3 build_places.py places.geojsonseq places.json
"""
import json
import sys
from collections import defaultdict
from datetime import date

CITY = "Краснодар"

# Улицы - только те, по которым ищут; служебные проезды и тропинки с названиями не нужны.
STREET_HIGHWAYS = {
    "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential",
    "living_street", "pedestrian", "road",
}

# Подпись вида объекта, если у него нет адреса. Остальные ключи - без подписи.
KIND_LABELS = {
    ("amenity", "cafe"): "кафе",
    ("amenity", "restaurant"): "ресторан",
    ("amenity", "fast_food"): "фастфуд",
    ("amenity", "bar"): "бар",
    ("amenity", "pub"): "паб",
    ("amenity", "pharmacy"): "аптека",
    ("amenity", "hospital"): "больница",
    ("amenity", "clinic"): "поликлиника",
    ("amenity", "school"): "школа",
    ("amenity", "kindergarten"): "детский сад",
    ("amenity", "university"): "вуз",
    ("amenity", "college"): "колледж",
    ("amenity", "bank"): "банк",
    ("amenity", "theatre"): "театр",
    ("amenity", "cinema"): "кинотеатр",
    ("amenity", "library"): "библиотека",
    ("amenity", "place_of_worship"): "храм",
    ("amenity", "post_office"): "почта",
    ("amenity", "police"): "полиция",
    ("shop", "mall"): "торговый центр",
    ("shop", "supermarket"): "супермаркет",
    ("tourism", "hotel"): "гостиница",
    ("tourism", "museum"): "музей",
    ("tourism", "attraction"): "достопримечательность",
    ("leisure", "park"): "парк",
    ("leisure", "stadium"): "стадион",
    ("leisure", "sports_centre"): "спорткомплекс",
    ("railway", "station"): "вокзал, станция",
}
POI_KEYS = ("amenity", "shop", "tourism", "leisure", "office", "historic", "craft", "healthcare")
PLACE_VALUES = {"suburb", "quarter", "neighbourhood", "village", "hamlet", "town", "city_block", "locality"}


def centroid(geometry):
    kind, coords = geometry["type"], geometry["coordinates"]
    if kind == "Point":
        return coords
    if kind == "LineString":
        return coords[len(coords) // 2]
    if kind in ("Polygon", "MultiPolygon"):
        ring = coords[0] if kind == "Polygon" else coords[0][0]
        points = ring[:-1] or ring
        return [sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points)]
    return None


def area_of(props):
    """Город из адреса - только если это не Краснодар: иначе подпись лишняя."""
    city = props.get("addr:city") or props.get("addr:place") or ""
    return city if city and city != CITY else ""


def kind_label(props):
    for key in POI_KEYS + ("railway",):
        value = props.get(key)
        if value and (key, value) in KIND_LABELS:
            return KIND_LABELS[(key, value)]
    return ""


def main(src, dst):
    rows = []
    seen = set()
    streets = defaultdict(list)  # (название, город) -> точки отрезков

    def add(kind, title, subtitle, lon, lat):
        # Один и тот же дом бывает и зданием, и отдельной точкой с адресом - адрес в городе
        # один, оставляем первый. Заведения с одним названием в разных местах - разные.
        key = (kind, title, subtitle) if kind == "a" else (kind, title, subtitle, round(lat, 3), round(lon, 3))
        if key in seen:
            return
        seen.add(key)
        rows.append([kind, title, subtitle, round(lat, 6), round(lon, 6)])

    with open(src, encoding="utf-8") as fh:
        for line in fh:
            feature = json.loads(line.lstrip("\x1e"))
            props = feature["properties"]
            point = centroid(feature["geometry"])
            if not point:
                continue
            lon, lat = point
            name = (props.get("name") or "").strip()
            street, number = props.get("addr:street"), props.get("addr:housenumber")
            address = f"{street}, {number}" if street and number else ""

            if address:
                add("a", address, area_of(props), lon, lat)

            if props.get("highway") in STREET_HIGHWAYS and name and feature["geometry"]["type"] == "LineString":
                streets[(name, area_of(props))].append(point)
                continue

            if not name:
                continue
            if any(key in props for key in POI_KEYS) or props.get("railway") == "station" or (
                "building" in props and address
            ):
                subtitle = ", ".join(filter(None, [address, area_of(props)])) or kind_label(props)
                add("p", name, subtitle, lon, lat)
            elif props.get("place") in PLACE_VALUES:
                add("l", name, area_of(props), lon, lat)

    # Улица - одна строка: точка отрезка, ближайшая к центру всех её отрезков.
    for (name, area), points in streets.items():
        cx = sum(p[0] for p in points) / len(points)
        cy = sum(p[1] for p in points) / len(points)
        lon, lat = min(points, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
        add("s", name, area, lon, lat)

    with open(dst, "w", encoding="utf-8") as fh:
        json.dump({"version": 1, "built": date.today().isoformat(), "rows": rows}, fh, ensure_ascii=False, separators=(",", ":"))
    counts = defaultdict(int)
    for row in rows:
        counts[row[0]] += 1
    print(f"{dst}: {len(rows)} строк {dict(counts)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
