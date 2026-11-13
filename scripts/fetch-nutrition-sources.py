"""Explicit public-source cache acquisition; rebuilding never needs network access."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request
import subprocess

SOURCES = {
    'usda-downloads': 'https://fdc.nal.usda.gov/download-datasets/',
    'usda-documentation': 'https://fdc.nal.usda.gov/data-documentation/',
    'usda-faq': 'https://fdc.nal.usda.gov/faq/',
    'niddk-constipation': 'https://www.niddk.nih.gov/health-information/digestive-diseases/constipation/eating-diet-nutrition',
    'niddk-gerd': 'https://www.niddk.nih.gov/health-information/digestive-diseases/acid-reflux-ger-gerd-adults/eating-diet-nutrition',
    'niddk-lactose': 'https://www.niddk.nih.gov/health-information/digestive-diseases/lactose-intolerance/eating-diet-nutrition',
    'niddk-nafld': 'https://www.niddk.nih.gov/health-information/liver-disease/nafld-nash/eating-diet-nutrition',
    'nhlbi-iron-anemia': 'https://www.nhlbi.nih.gov/health/anemia/iron-deficiency-anemia',
    'niddk-weight': 'https://www.niddk.nih.gov/health-information/weight-management/adult-overweight-obesity/eating-physical-activity',
    'nhs-weight-gain': 'https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/healthy-ways-to-gain-weight/',
    'nhs-policy': 'https://www.nhs.uk/our-policies/terms-and-conditions/',
}
# NIH ODS direct acquisition returned a challenge. Its separately preserved public
# web-tool rendered snapshot has explicit provenance; this downloader does not solve challenges.
USDA = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--windows-curl', action='store_true', help='Use Schannel system trust; never disables TLS verification')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    for key, url in {**SOURCES, 'usda-sr-2018': USDA}.items():
        path = args.cache / (key + ('.zip' if key == 'usda-sr-2018' else '.html'))
        if not path.exists():
            if args.windows_curl:
                result = subprocess.run(['curl.exe', '--fail', '--silent', '--show-error', '--location',
                    '--max-redirs', '3', '--max-time', '60', '--proto', '=https', '--proto-redir', '=https', url],
                    capture_output=True, check=True)
                raw = result.stdout
            else:
                request = urllib.request.Request(url, headers={'User-Agent': 'ShiweiPublicResearch/1.0'})
                with urllib.request.urlopen(request, timeout=45) as response:
                    raw = response.read()
            if not raw or (path.suffix == '.zip' and not raw.startswith(b'PK')):
                raise ValueError('PUBLIC_SOURCE_CONTENT_INVALID: ' + key)
            path.write_bytes(raw)
        print(json.dumps({'id': key, 'bytes': path.stat().st_size,
                          'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}), flush=True)

if __name__ == '__main__':
    main()
