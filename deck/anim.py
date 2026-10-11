"""Add slide transitions and staggered fade-in entrance animations to ChillDesk.pptx.

Every shape whose name starts with "anim_" fades in automatically when the slide opens, in document order.
    .venv/bin/python anim.py ChillDesk.pptx
"""
from __future__ import annotations

import re
import shutil
import sys
import tempfile
import zipfile

STAGGER_MS = 90
FADE_MS = 450
TRANSITIONS = ['<p:fade/>', '<p:push dir="u"/>', '<p:fade/>', '<p:push dir="l"/>', '<p:fade/>', '<p:push dir="u"/>',
               '<p:fade/>', '<p:push dir="l"/>', '<p:fade/>', '<p:push dir="u"/>', '<p:fade/>']


def timing_xml(spids: list[str]) -> str:
    ctn = [3]  # running cTn id; 1 and 2 are the root and main sequence

    def nid() -> int:
        ctn[0] += 1
        return ctn[0]

    effects = []
    for i, spid in enumerate(spids):
        outer, eff, setid, animid = nid(), nid(), nid(), nid()
        effects.append(
            f'<p:par><p:cTn id="{outer}" fill="hold"><p:stCondLst><p:cond delay="{i * STAGGER_MS}"/></p:stCondLst><p:childTnLst>'
            f'<p:par><p:cTn id="{eff}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="withEffect">'
            f'<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
            f'<p:set><p:cBhvr><p:cTn id="{setid}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>'
            f'</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
            f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{animid}" dur="{FADE_MS}"/>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>'
            f'</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>')
    return (
        '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>'
        '<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
        + "".join(effects) +
        '</p:childTnLst></p:cTn></p:par>'
        '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
        '</p:childTnLst></p:cTn></p:par></p:tnLst>'
        '<p:bldLst>' + "".join(f'<p:bldP spid="{s}" grpId="0"/>' for s in spids if s in BUILD_TEXT) + '</p:bldLst></p:timing>')


BUILD_TEXT: set[str] = set()


def process(xml: str, idx: int) -> str:
    BUILD_TEXT.clear()
    xml = re.sub(r"<p:transition\b.*?</p:transition>|<p:transition\b[^>]*/>", "", xml, flags=re.S)
    xml = re.sub(r"<p:timing\b.*?</p:timing>", "", xml, flags=re.S)
    spids = []
    # each shape: <p:sp>/<p:pic>/<p:graphicFrame>/<p:cxnSp> with <p:cNvPr id=".." name="anim_...">
    for m in re.finditer(r"<p:(sp|pic|graphicFrame|cxnSp)>.*?</p:\1>", xml, flags=re.S):
        nv = re.search(r'<p:cNvPr id="(\d+)" name="(anim_[^"]*)"', m.group(0))
        if nv:
            spids.append(nv.group(1))
            if m.group(1) == "sp" and "<p:txBody>" in m.group(0):
                BUILD_TEXT.add(nv.group(1))
    trans = f'<p:transition spd="slow">{TRANSITIONS[idx % len(TRANSITIONS)]}</p:transition>'
    timing = timing_xml(spids) if spids else ""
    anchor = "</p:clrMapOvr>"
    if anchor in xml:
        return xml.replace(anchor, anchor + trans + timing, 1)
    return xml.replace("</p:cSld>", "</p:cSld>" + trans + timing, 1)


def main(path: str) -> None:
    tmp = tempfile.mktemp(suffix=".pptx")
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            m = re.fullmatch(r"ppt/slides/slide(\d+)\.xml", item.filename)
            if m:
                data = process(data.decode("utf-8"), int(m.group(1)) - 1).encode("utf-8")
            zout.writestr(item, data)
    shutil.move(tmp, path)
    print("animated", path)


if __name__ == "__main__":
    main(sys.argv[1])
