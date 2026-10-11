"""Add Morph transitions and staggered entrance animations to ChillDesk.pptx (PowerPoint for the web compatible).

- Slide transitions: Morph (objects named "!!..." glide between slides), with Fade as the fallback.
- Every shape named "anim_*" enters automatically when the slide opens, in document order:
  pictures zoom in softly with a fade, everything else floats in from below with a fade (decelerating).
    .venv/bin/python anim.py ChillDesk.pptx
"""
from __future__ import annotations

import re
import shutil
import sys
import tempfile
import zipfile

STAGGER_MS = 110
DUR_MS = 800
MORPH = ('<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">'
         '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">'
         '<p:transition spd="slow" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" p14:dur="1600">'
         '<p159:morph option="byObject"/></p:transition></mc:Choice>'
         '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>')


class Ids:
    def __init__(self) -> None:
        self.n = 3

    def __call__(self) -> int:
        self.n += 1
        return self.n


def _visible(nid, spid):
    return (f'<p:set><p:cBhvr><p:cTn id="{nid()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>'
            f'</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>')


def _fade(nid, spid):
    return (f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{nid()}" dur="{DUR_MS}"/>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect>')


def _prop(nid, spid, attr, start, end):
    return (f'<p:anim calcmode="lin" valueType="num"><p:cBhvr><p:cTn id="{nid()}" dur="{DUR_MS}" decel="100000" fill="hold"/>'
            f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr>'
            f'<p:tavLst><p:tav tm="0"><p:val><p:strVal val="{start}"/></p:val></p:tav>'
            f'<p:tav tm="100000"><p:val><p:strVal val="{end}"/></p:val></p:tav></p:tavLst></p:anim>')


def effect(nid, spid: str, kind: str, delay: int) -> str:
    outer, eff = nid(), nid()
    if kind == "pic":   # Zoom (preset 53): grow from 88% with a fade
        preset, sub = 53, 16
        body = (_visible(nid, spid) + _prop(nid, spid, "ppt_w", "#ppt_w*0.88", "#ppt_w")
                + _prop(nid, spid, "ppt_h", "#ppt_h*0.88", "#ppt_h") + _fade(nid, spid))
    else:               # Float In (preset 42): rise 6% of the slide height with a fade
        preset, sub = 42, 0
        body = (_visible(nid, spid) + _fade(nid, spid) + _prop(nid, spid, "ppt_x", "#ppt_x", "#ppt_x")
                + _prop(nid, spid, "ppt_y", "#ppt_y+.06", "#ppt_y"))
    return (f'<p:par><p:cTn id="{outer}" fill="hold"><p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>'
            f'<p:par><p:cTn id="{eff}" presetID="{preset}" presetClass="entr" presetSubtype="{sub}" fill="hold" grpId="0" nodeType="withEffect">'
            f'<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>'
            f'</p:childTnLst></p:cTn></p:par>')


def timing_xml(items: list[tuple[str, str]], text_ids: set[str]) -> str:
    nid = Ids()
    effects = "".join(effect(nid, spid, kind, i * STAGGER_MS) for i, (spid, kind) in enumerate(items))
    return (
        '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/>'
        '<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
        + effects +
        '</p:childTnLst></p:cTn></p:par>'
        '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
        '</p:childTnLst></p:cTn></p:par></p:tnLst>'
        '<p:bldLst>' + "".join(f'<p:bldP spid="{s}" grpId="0"/>' for s, _ in items if s in text_ids) + '</p:bldLst></p:timing>')


def process(xml: str) -> str:
    xml = re.sub(r"<mc:AlternateContent\b(?:(?!</mc:AlternateContent>).)*?<p:transition\b.*?</mc:AlternateContent>", "", xml, flags=re.S)
    xml = re.sub(r"<p:transition\b.*?</p:transition>|<p:transition\b[^>]*/>", "", xml, flags=re.S)
    xml = re.sub(r"<p:timing\b.*?</p:timing>", "", xml, flags=re.S)
    items, text_ids = [], set()
    for m in re.finditer(r"<p:(sp|pic|graphicFrame|cxnSp)>.*?</p:\1>", xml, flags=re.S):
        nv = re.search(r'<p:cNvPr id="(\d+)" name="(anim_[^"]*)"', m.group(0))
        if not nv:
            continue
        kind = "pic" if m.group(1) in ("pic", "graphicFrame") else "shape"
        items.append((nv.group(1), kind))
        if m.group(1) == "sp" and "<p:txBody>" in m.group(0):
            text_ids.add(nv.group(1))
    timing = timing_xml(items, text_ids) if items else ""
    anchor = "</p:clrMapOvr>"
    if anchor in xml:
        return xml.replace(anchor, anchor + MORPH + timing, 1)
    return xml.replace("</p:cSld>", "</p:cSld>" + MORPH + timing, 1)


def main(path: str) -> None:
    tmp = tempfile.mktemp(suffix=".pptx")
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if re.fullmatch(r"ppt/slides/slide\d+\.xml", item.filename):
                data = process(data.decode("utf-8")).encode("utf-8")
            zout.writestr(item, data)
    shutil.move(tmp, path)
    print("animated", path)


if __name__ == "__main__":
    main(sys.argv[1])
