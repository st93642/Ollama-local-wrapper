#!/usr/bin/env python3
"""
Ollama Wrapper Single-File Bundle Generator

Creates a standalone HTML file with all CSS/JS/assets inlined, no external dependencies.
Usage: python3 scripts/bundle_single_file.py [output_path]
"""

import os
import sys
import json
import re
from pathlib import Path

# Bootstrap icon SVGs
ICON_SVGS = {
    'bi-chat-dots': '''<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16" class="bi bi-chat-dots"><path d="M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/><path d="m2.165 15.803.02-.004c1.83-.363 2.948-.842 3.468-1.105A9.06 9.06 0 0 0 8 15.5c4.418 0 8-1.79 8-4s-3.582-4-8-4-8 1.79-8 4c0 .393.049.776.122 1.15.821-.347 2.1-.966 2.965-1.554.889-.675 1.68-1.299 2.289-1.562.502-.227.856-.294 1.071-.294.215 0 .569.067 1.071.294.609.263 1.4.887 2.289 1.562.865.588 2.144 1.207 2.965 1.554.073-.374.122-.757.122-1.15 0-2.21-3.582-4-8-4s-8 1.79-8 4c0 1.976 1.708 3.71 4.165 3.803z"/></svg>''',
    'bi-sun-fill': '''<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16" class="bi bi-sun-fill"><path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V.5A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2a.5.5 0 0 1 .5-.5zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/></svg>''',
    'bi-moon-stars-fill': '''<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16" class="bi bi-moon-stars-fill"><path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/><path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.734 1.734 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.734 1.734 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.734 1.734 0 0 0 1.097-1.097l.387-1.162zM13.863 9.101a.145.145 0 0 1 .274 0l.258.774c.115.345.386.616.73.73l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.73.73l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.73-.73l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.344-.114.615-.385.73-.73l.258-.774z"/></svg>''',
}

def read_file(path):
    """Read file content."""
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def read_binary_file(path):
    """Read binary file content."""
    with open(path, 'rb') as f:
        return f.read()

def minify_css(css):
    """Basic CSS minification."""
    # Remove comments
    css = re.sub(r'/\*[^*]*\*+(?:[^/*][^*]*\*+)*/', '', css)
    # Remove whitespace
    css = re.sub(r'\s+', ' ', css)
    # Remove spaces around certain characters
    css = re.sub(r'\s*([{};:,>+~])\s*', r'\1', css)
    return css.strip()

def minify_js(js):
    """Basic JavaScript minification."""
    # Remove single-line comments
    lines = []
    for line in js.split('\n'):
        # Remove // comments
        line = re.sub(r'//.*$', '', line)
        if line.strip():
            lines.append(line)
    
    js = '\n'.join(lines)
    
    # Remove multi-line comments
    js = re.sub(r'/\*[^*]*\*+(?:[^/*][^*]*\*+)*/', '', js)
    
    # Minify whitespace
    js = re.sub(r';\s*\n\s*', ';', js)
    js = re.sub(r'\s+', ' ', js)
    js = re.sub(r'\s*([{};:,=\(\)\[\]<>+\-*/%&|^!?])\s*', r'\1', js)
    
    return js.strip()

def replace_icons(html):
    """Replace Bootstrap icon classes with inline SVGs."""
    for icon_class, svg in ICON_SVGS.items():
        # Replace <i class="bi bi-{icon}"></i> with SVG
        pattern = f'<i class="bi {icon_class}"></i>'
        html = html.replace(pattern, svg)
        # Also handle variations with id or other attributes
        pattern = f'<i class="bi {icon_class} '
        replacement = f'{svg} style="display: inline-block; '
        html = re.sub(
            f'<i class="bi {icon_class}([^"]*)"([^>]*)>',
            lambda m: svg.replace('</svg>', f'</svg>'),
            html
        )
    
    return html

def load_manifest(manifest_path):
    """Load and return manifest data as JSON string."""
    with open(manifest_path, 'r', encoding='utf-8') as f:
        return f.read()

def create_bundle(output_path='dist/ollama-wrapper.html'):
    """Create the bundled single-file HTML."""
    base_dir = Path(__file__).parent.parent
    
    # Read source files
    html = read_file(base_dir / 'index.html')
    css = read_file(base_dir / 'style.css')
    js = read_file(base_dir / 'app.js')
    manifest = load_manifest(base_dir / 'manifest.json')
    bootstrap_css = read_file(base_dir / 'vendor' / 'bootstrap.min.css')
    bootstrap_js = read_file(base_dir / 'vendor' / 'bootstrap.bundle.min.js')
    
    # Remove external CDN links and add inline content
    # Remove Bootstrap CSS link
    html = re.sub(
        r'<link href="https://cdn\.jsdelivr\.net/npm/bootstrap@[^"]*"[^>]*>',
        '',
        html
    )
    # Remove Bootstrap Icons font link
    html = re.sub(
        r'<link rel="stylesheet" href="https://cdn\.jsdelivr\.net/npm/bootstrap-icons[^"]*"[^>]*>',
        '',
        html
    )
    # Remove Bootstrap JS script
    html = re.sub(
        r'<script src="https://cdn\.jsdelivr\.net/npm/bootstrap@[^<]*</script>',
        '',
        html
    )
    # Remove custom style.css link
    html = re.sub(
        r'<link rel="stylesheet" href="style\.css">',
        '',
        html
    )
    # Remove app.js script
    html = re.sub(
        r'<script src="app\.js"></script>',
        '',
        html
    )
    
    # Replace icon classes with inline SVGs
    html = replace_icons(html)
    
    # Find the head end and inject Bootstrap CSS
    css_combined = minify_css(bootstrap_css) + minify_css(css)
    head_injection = f'<style>\n{css_combined}\n</style>'
    html = html.replace('</head>', f'{head_injection}\n</head>')
    
    # Inject manifest as embedded JSON
    manifest_injection = f'<script type="application/json" id="embeddedManifest">{manifest}</script>'
    html = html.replace('</head>', f'{manifest_injection}\n</head>')
    
    # Find the body end and inject all JS
    minified_js = minify_js(js)
    minified_bootstrap_js = minify_js(bootstrap_js)
    js_injection = f'<script>\n{minified_bootstrap_js}\n{minified_js}\n</script>'
    html = html.replace('</body>', f'{js_injection}\n</body>')
    
    # Write output
    output_file = base_dir / output_path
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html)
    
    file_size = output_file.stat().st_size
    size_kb = file_size / 1024
    
    print(f'✓ Bundle created: {output_path}')
    print(f'  File size: {size_kb:.1f} KB')
    
    if size_kb > 500:
        print(f'  ⚠ Warning: File size exceeds 500 KB limit')
    
    return output_file

if __name__ == '__main__':
    output_path = sys.argv[1] if len(sys.argv) > 1 else 'dist/ollama-wrapper.html'
    create_bundle(output_path)
