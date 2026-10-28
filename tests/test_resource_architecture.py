from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ResourcePresentationArchitectureTests(unittest.TestCase):
    def test_generic_runtime_has_no_assets_special_case(self):
        runtime = ROOT / 'app/src/app/resource-runtime'
        for path in runtime.iterdir():
            if path.suffix not in ('.ts', '.html') or path.name.endswith(('.spec.ts', '.proof.ts')) or path.name == 'runtime-fixtures.ts':
                continue
            with self.subTest(file=path.name):
                self.assertNotIn('assets.', path.read_text().lower())
