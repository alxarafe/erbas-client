"""Validate the real vendored APF contract used by npm ci and Docker."""
import hashlib
import json
from pathlib import Path
import tarfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'app'
VENDOR = APP / 'vendor'
RUNTIME_PACKAGE = '@alxarafe/ui-runtime'


class ThemePackageTests(unittest.TestCase):
    def test_archives_integrity_public_exports_and_exact_runtime_peers(self):
        provenance = json.loads((VENDOR / 'aur-integration-002-provenance.json').read_text())
        dependencies = json.loads((APP / 'package.json').read_text())['dependencies']
        locked = json.loads((APP / 'package-lock.json').read_text())['packages']
        manifests = {}
        for record in provenance['archives']:
            path = VENDOR / record['archive']
            with self.subTest(archive=path.name):
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), record['sha256'])
                with tarfile.open(path) as archive:
                    manifest = json.load(archive.extractfile('package/package.json'))
                    manifests[manifest['name']] = manifest
                    self.assertTrue(manifest['private'])
                    self.assertIn('exports', manifest)
                    self.assertTrue(any(name.startswith('package/fesm2022/') for name in archive.getnames()))
                    self.assertTrue(any(name.endswith('.d.ts') for name in archive.getnames()))
                    if manifest['name'] != RUNTIME_PACKAGE:
                        self.assertEqual(manifest['exports']['./theme.css'], './theme.css')
                        self.assertTrue(archive.extractfile('package/theme.css').read())
                        conformance = json.load(archive.extractfile('package/conformance.json'))
                        self.assertEqual(conformance['sourceCommit'], provenance['sourceCommit'])
                        self.assertEqual(conformance['sourceStatus'], provenance['sourceStatus'])
                dependency = 'file:vendor/' + path.name
                self.assertEqual(dependencies[manifest['name']], dependency)
                self.assertEqual(locked['node_modules/' + manifest['name']]['resolved'], dependency)
                self.assertEqual(locked['node_modules/' + manifest['name']]['version'], manifest['version'])
        self.assertEqual(set(manifests), {name for name in dependencies if name.startswith('@alxarafe/')})
        runtime_version = manifests[RUNTIME_PACKAGE]['version']
        for name, manifest in manifests.items():
            if name == RUNTIME_PACKAGE:
                continue
            self.assertEqual(manifest['peerDependencies'][RUNTIME_PACKAGE], runtime_version)
            self.assertIn("@import '" + name + "/theme.css';", (APP / 'src/styles.css').read_text())
