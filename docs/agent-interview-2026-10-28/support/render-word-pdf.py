"""Use the packaged render_docx rasterizer with a Word-exported PDF on Windows.
The packaged runtime does not bundle LibreOffice on Windows. No desktop
LibreOffice is used. The requested DOCX is still read for DPI and rasterized
through render_docx.py; only its conversion function is replaced.
"""
from pathlib import Path
import importlib.util, sys, os
SKILL=Path('C:/Users/彭霄/.codex/plugins/cache/openai-primary-runtime/documents/26.1025.11240/skills/documents')
ROOT=Path(__file__).resolve().parent.parent
POPPLER=Path('C:/Users/彭霄/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin')
os.environ['PATH']=str(POPPLER)+os.pathsep+os.environ.get('PATH','')
spec=importlib.util.spec_from_file_location('packaged_render_docx',SKILL/'render_docx.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
for docx in sorted(ROOT.glob('0[123]_*.docx')):
    pdf=ROOT/'support'/'qa'/(docx.stem+'.pdf')
    if not pdf.exists():raise FileNotFoundError(pdf)
    def convert(input_path,profile_dir,convert_tmp_dir,stem,verbose=False,**kwargs):
        return str(pdf),'Conversion: installed Microsoft Word COM export; packaged renderer has no bundled Windows LibreOffice.'
    module.convert_to_pdf=convert
    out=ROOT/'support'/'qa'/docx.stem
    sys.argv=['render_docx.py',str(docx),'--output_dir',str(out),'--dpi','110']
    module.main()
