"""Offline deterministic, versioned public nutrition expansion. No inferred intake targets."""
import argparse
import csv
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET

VERSION = 'nutrition-guidance-2026-11-13-v1'
ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'datasets/health/nutrition-curation-v1.json'
sha = lambda x: hashlib.sha256(x).hexdigest()
encode = lambda x: (json.dumps(x, ensure_ascii=False, indent=2) + '\n').encode('utf-8')

class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.ignored = [], 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'):
            self.ignored += 1
        elif tag in ('p', 'li', 'h1', 'h2', 'h3', 'h4', 'div', 'section', 'main', 'br'):
            self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'):
            self.ignored -= 1
        elif tag in ('p', 'li', 'h1', 'h2', 'h3', 'h4', 'div', 'section', 'main'):
            self.parts.append('\n')
    def handle_data(self, data):
        if not self.ignored:
            self.parts.append(data)
    def text(self):
        return '\n'.join(re.sub(r'\s+', ' ', line).strip() for line in ''.join(self.parts).split('\n') if line.strip())

def document(raw, acquisition):
    text = raw.decode('utf-8-sig', errors='strict')
    if acquisition == 'web_tool_rendered_excerpt':
        # The web tool preserved official page line numbers; this is explicitly NOT original HTML.
        lines = {}
        for line in text.splitlines():
            if m := re.match(r'^L(\d+): ?(.*)$', line):
                number, value = int(m.group(1)), m.group(2)
                if number in lines and lines[number] != value:
                    raise ValueError('WEB_SNAPSHOT_INCONSISTENT_LINE')
                lines[number] = value
        text = '\n'.join(lines[k] for k in sorted(lines))
        return re.sub(r'【[^】]*】', '', text)
    parser = VisibleText()
    parser.feed(text)
    return parser.text()

def build(cache, output):
    cache, output = cache.resolve(), output.resolve()
    if output.is_relative_to(cache) or cache.is_relative_to(output):
        raise ValueError('OUTPUT_OVERLAPS_SOURCE_CACHE')
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    source_lock = json.loads((CONFIG.parent / 'nutrition-source-lock-v1.json').read_text(encoding='utf-8'))
    sources, texts = [], {}
    for source in config['sources']:
        raw = (cache / source['cacheFile']).read_bytes()
        if sha(raw) != source_lock[source['id']]:
            raise ValueError('SOURCE_LOCK_MISMATCH: ' + source['id'])
        texts[source['id']] = document(raw, source['acquisition']) if source['id'] != 'usda-sr-2018' else ''
        sources.append({**source, 'sourceHash': sha(raw), 'retrievedDate': '2026-11-13', 'status': 'active'})
    evidence = []
    for entry in config['evidence']:
        source = next(s for s in sources if s['id'] == entry['sourceId'])
        text, span = texts[source['id']], entry['originalSpan']
        if text.count(span) != 1 or '\ufffd' in span:
            raise ValueError('EVIDENCE_NOT_UNIQUE_IN_SOURCE: ' + entry['id'])
        start = text.index(span)
        # Evidence must be in an article section, after its content heading, never the navigation.
        heading = entry['bodyHeading']
        if heading not in text[:start + len(span)]:
            raise ValueError('EVIDENCE_OUTSIDE_BODY: ' + entry['id'])
        evidence.append({k: entry[k] for k in ('id', 'sourceId')} | {
            'title': source['title'], 'version': source['version'], 'url': source['url'],
            'sourceHash': source['sourceHash'], 'originalSpan': span, 'spanHash': sha(span.encode('utf-8')),
            'locator': {'kind': source['acquisition'], 'normalization': 'public_visible_text_v1',
                        'section': entry['section'], 'start': start, 'end': start + len(span)},
        })
    archive = zipfile.ZipFile(cache / 'usda-sr-2018.zip')
    def rows(name):
        member = next(p for p in archive.namelist() if p.endswith('/' + name))
        return list(csv.DictReader(io.TextIOWrapper(archive.open(member), encoding='utf-8-sig')))
    foods_raw, nutrients_raw = {r['fdc_id']: r for r in rows('food.csv')}, {r['id']: r for r in rows('nutrient.csv')}
    ndb = {r['fdc_id']: r['NDB_number'] for r in rows('sr_legacy_food.csv')}
    derivations = {r['id']: r for r in rows('food_nutrient_derivation.csv')}
    foods, nutrients, values = [], [], []
    for food in config['foods']:
        original = foods_raw[food['fdcId']]
        if original['description'] != food['sourceDescription']:
            raise ValueError('FOOD_IDENTITY_CHANGED')
        foods.append({**food, 'id': 'usda:' + food['fdcId'], 'ndbNumber': ndb[food['fdcId']],
                      'sourceId': 'usda-sr-2018', 'publicationDate': original['publication_date'],
                      'basis': {'amount': 100, 'unit': 'g', 'portion': 'edible_portion'},
                      'scope': 'US_SR_Legacy_reference_not_Chinese_food_measurement'})
    for nutrient in config['nutrients']:
        raw = nutrients_raw.get(nutrient['usdaId'])
        if raw and raw['unit_name'] != nutrient['unit']:
            raise ValueError('NUTRIENT_UNIT_CHANGED')
        nutrients.append({**nutrient, 'sourceName': raw['name'] if raw else None})
    selected = {f['fdcId'] for f in foods}
    wanted = {n['usdaId'] for n in nutrients}
    original_values = {}
    for line, row in enumerate(rows('food_nutrient.csv'), 2):
        key = (row['fdc_id'], row['nutrient_id'])
        if key[0] in selected and key[1] in wanted:
            if key in original_values:
                raise ValueError('DUPLICATE_COMPOSITION_CELL')
            original_values[key] = (line, row)
    for food in foods:
        for nutrient in nutrients:
            found = original_values.get((food['fdcId'], nutrient['usdaId']))
            row = found[1] if found else None
            value = float(row['amount']) if row and row['amount'] != '' else None
            values.append({'id': f"composition:{food['fdcId']}:{nutrient['id']}", 'foodId': food['id'],
                'nutrientId': nutrient['id'], 'value': value, 'amountText': row['amount'] if row else None,
                'unit': nutrient['unit'], 'status': 'source_reported' if value is not None else 'not_reported',
                'sourceRow': row, 'csvRow': found[0] if found else None,
                'rowHash': sha(json.dumps(row, sort_keys=True, separators=(',', ':')).encode()) if row else None,
                'derivation': derivations.get(row['derivation_id']) if row else None})
    dataset = {'schemaVersion': '1.0.0', 'id': VERSION, 'status': 'local_research', 'clinicalRelease': None,
        'professionalReview': 'pending', 'createdDate': '2026-11-13', 'sources': sources, 'evidence': evidence,
        'topics': config['topics'], 'objects': config['objects'], 'facts': config['facts'],
        'principles': config['principles'], 'foods': foods, 'nutrients': nutrients, 'values': values,
        'boundaries': {'personalDataIncluded': False, 'newEmbeddingBuilt': False, 'onlineEnabled': False,
                       'personalEnergyPrescription': False, 'recipeNutritionCalculated': False},
        'exclusions': config['exclusions']}
    documentation_member = next(p for p in archive.namelist() if p.endswith('.xlsx'))
    documentation = archive.read(documentation_member)
    workbook = zipfile.ZipFile(io.BytesIO(documentation))
    shared_strings = [''.join(e.itertext()) for e in ET.fromstring(workbook.read('xl/sharedStrings.xml'))]
    definition = 'Amount of the nutrient per 100g of food. Specified in unit defined in the nutrient table.'
    if shared_strings.count(definition) != 1:
        raise ValueError('COMPOSITION_BASIS_NOT_VERIFIED')
    provenance = {'sourceId': 'usda-sr-2018', 'archiveHash': source_lock['usda-sr-2018'],
        'archiveUrl': 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
        'memberHashes': {p: sha(archive.read(p)) for p in archive.namelist() if p.endswith(('/food.csv', '/nutrient.csv', '/food_nutrient.csv', '/sr_legacy_food.csv', '/food_nutrient_derivation.csv'))},
        'basisDefinition': {'member': documentation_member, 'sha256': sha(documentation),
            'xmlPart': 'xl/sharedStrings.xml', 'stringIndex': shared_strings.index(definition), 'originalSpan': definition},
        'rowNumberSemantics': 'CSV record ordinal including header as row 1; not physical text line number',
        'valueSemantics': 'Source-reported reference composition; retain analytical/calculated/imputed derivation metadata. Zero does not establish absolute absence.'}
    raw, provenance_raw = encode(dataset), encode(provenance)
    counts = {k: len(dataset[k]) for k in ('sources', 'evidence', 'topics', 'objects', 'facts', 'principles', 'foods', 'nutrients', 'values')}
    counts['reportedValues'] = sum(v['value'] is not None for v in values)
    counts['missingValues'] = len(values) - counts['reportedValues']
    manifest = {'id': VERSION, 'schemaVersion': '1.0.0', 'clinicalRelease': None, 'counts': counts,
        'files': {'knowledge.json': sha(raw), 'composition-provenance.json': sha(provenance_raw)}, 'sourceLockHash': sha((CONFIG.parent / 'nutrition-source-lock-v1.json').read_bytes()),
        'curationHash': sha(CONFIG.read_bytes()), 'builderVersion': 'nutrition-offline-v1'}
    output.mkdir(parents=True, exist_ok=True)
    for name, content in [('knowledge.json', raw), ('composition-provenance.json', provenance_raw), ('manifest.json', encode(manifest))]:
        path = output / name
        if path.exists():
            if path.read_bytes() != content:
                raise ValueError('IMMUTABLE_OUTPUT_USE_NEW_VERSION_OR_EMPTY_OUTPUT: ' + name)
            continue
        path.write_bytes(content)
    print(json.dumps({'id': VERSION, 'counts': counts, 'sha256': sha(raw)}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'datasets/health' / VERSION)
    args = parser.parse_args()
    build(args.cache, args.output)
