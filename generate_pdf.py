#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import json
import os
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from PIL import Image as PILImage

# ─── Utilidades ───────────────────────────────────────────────────────────────

def fmt(n):
    """Formato peso argentino: $1.234,56"""
    if n is None:
        n = 0
    s = f"{float(n):,.2f}"
    return "$" + s.replace(",", "X").replace(".", ",").replace("X", ".")

def fmt_date(s):
    if not s:
        return ""
    parts = str(s).split("-")
    if len(parts) == 3:
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return s

def val(obj, key):
    v = obj.get(key)
    return str(v) if v else ""

# ─── Datos ────────────────────────────────────────────────────────────────────

raw = sys.stdin.buffer.read().decode("utf-8-sig")  # maneja BOM si lo hay
data = json.loads(raw)
p          = data["p"]
repuestos  = data["repuestos"]
mano_obra  = data["manoObra"]
sub_rep    = float(data["subtotalRep"])
sub_mo     = float(data["subtotalMO"])
total      = float(data["total"])
logo_path  = data.get("logoPath", "")

# ─── Fuentes ──────────────────────────────────────────────────────────────────

FONTS_DIR = r"C:\Windows\Fonts"
ARIAL     = os.path.join(FONTS_DIR, "arial.ttf")
ARIAL_B   = os.path.join(FONTS_DIR, "arialbd.ttf")

# ─── PDF ──────────────────────────────────────────────────────────────────────

class PresupuestoPDF(FPDF):
    def footer(self):
        self.set_y(-13)
        try:
            self.set_font(F, "", 7)
        except Exception:
            self.set_font("Helvetica", "", 7)
        self.set_text_color(140, 140, 140)
        numero = p.get("numero", "") or ""
        codigo = p.get("codigo_serie", "") or ""
        texto = f"N° {numero}"
        if codigo:
            texto += f"   |   Código de serie: {codigo}"
        self.cell(W, 5, texto, align="C")

pdf = PresupuestoPDF(orientation="P", unit="mm", format="A4")
pdf.set_margins(15, 15, 15)
pdf.set_auto_page_break(auto=True, margin=20)
pdf.add_page()

# Registrar fuentes Unicode
if os.path.exists(ARIAL) and os.path.exists(ARIAL_B):
    pdf.add_font("f", "",  ARIAL)
    pdf.add_font("f", "B", ARIAL_B)
    F = "f"
else:
    F = "Helvetica"

W = 180  # ancho útil (210 - 15*2)

# ══════════════════════════════════════════════════════════════════════════════
# ENCABEZADO — logo centrado + datos de empresa
# ══════════════════════════════════════════════════════════════════════════════

if logo_path and os.path.exists(logo_path):
    with PILImage.open(logo_path) as img:
        px_w, px_h = img.size
    logo_w = 110.0                           # ancho en mm
    logo_h = logo_w * px_h / px_w           # alto proporcional
    logo_x = 15 + (W - logo_w) / 2
    y0 = pdf.get_y()
    pdf.image(logo_path, x=logo_x, y=y0, w=logo_w, h=logo_h)
    pdf.set_y(y0 + logo_h + 3)

# Datos empresa
pdf.set_font(F, "", 9)
pdf.set_text_color(90, 90, 90)
for line in [
    "Montibelli Javier Hernan",
    "Av. Mosconi 1296, (1752) Lomas del Mirador, Pcia. de Bs. As.",
    "CUIT: 23-22023139-9  |  IIBB: 23-22023139-9  |  Inicio de actividades: 13/03/2008",
]:
    pdf.cell(W, 5, line, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

pdf.ln(5)

# Línea separadora gruesa
pdf.set_draw_color(20, 20, 20)
pdf.set_line_width(0.8)
pdf.line(15, pdf.get_y(), 195, pdf.get_y())
pdf.ln(7)

# ══════════════════════════════════════════════════════════════════════════════
# TÍTULO DEL DOCUMENTO
# ══════════════════════════════════════════════════════════════════════════════

pdf.set_text_color(0, 0, 0)
pdf.set_font(F, "B", 10)
pdf.set_fill_color(240, 240, 240)
pdf.set_draw_color(180, 180, 180)
pdf.set_line_width(0.3)
pdf.cell(W, 8,
    "DOCUMENTO NO VÁLIDO COMO FACTURA  —  PRESUPUESTO",
    align="C", fill=True, border=1,
    new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(6)

# ══════════════════════════════════════════════════════════════════════════════
# N° y FECHA
# ══════════════════════════════════════════════════════════════════════════════

pdf.set_font(F, "B", 10)
pdf.cell(W / 2, 6, f"N°: {val(p, 'numero')}")
pdf.cell(W / 2, 6, f"Fecha: {fmt_date(p.get('fecha_emision'))}", align="R",
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(5)

# ══════════════════════════════════════════════════════════════════════════════
# CUADRO DE DATOS DEL ASEGURADO / VEHÍCULO
# ══════════════════════════════════════════════════════════════════════════════

fields = [
    ("Sres.:",         val(p, "asegurado")),
    ("Domicilio:",     val(p, "domicilio_asegurado")),
    ("Marca:",         val(p, "marca")),
    ("Patente:",       val(p, "patente")),
    ("Modelo:",        val(p, "modelo")),
    ("Tipo:",          val(p, "tipo_moto")),
    ("Compañía:",      val(p, "compania_nombre")),
]

ROW_H  = 6.5
COL_W  = W / 2
PAD    = 3
LABEL  = 30
rows   = (len(fields) + 1) // 2
box_h  = rows * ROW_H + PAD * 2
box_y  = pdf.get_y()

pdf.set_fill_color(251, 251, 251)
pdf.set_draw_color(200, 200, 200)
pdf.set_line_width(0.3)
pdf.rect(15, box_y, W, box_h, style="FD")

for i, (label, value) in enumerate(fields):
    col = i % 2
    row = i // 2
    x = 15 + col * COL_W + PAD
    y = box_y + PAD + row * ROW_H
    pdf.set_xy(x, y)
    pdf.set_font(F, "B", 9)
    pdf.cell(LABEL, ROW_H, label)
    pdf.set_font(F, "", 9)
    avail = COL_W - LABEL - PAD * 2
    pdf.cell(avail, ROW_H, value[:int(avail / 1.8)])   # truncar si muy largo

pdf.set_y(box_y + box_h + 6)

# ══════════════════════════════════════════════════════════════════════════════
# TABLA REPUESTOS
# ══════════════════════════════════════════════════════════════════════════════

def draw_table_header(cols, heights=7):
    pdf.set_fill_color(35, 35, 35)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font(F, "B", 9)
    for txt, w, align in cols:
        pdf.cell(w, heights, txt, align=align, fill=True)
    pdf.ln()
    pdf.set_text_color(0, 0, 0)

def draw_subtotal_row(label, amount, total_w):
    pdf.set_fill_color(232, 232, 232)
    pdf.set_font(F, "B", 9.5)
    label_w = total_w - 35
    pdf.cell(label_w, 6.5, label, align="R", fill=True)
    pdf.cell(35, 6.5, fmt(amount), align="R", fill=True,
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)

if repuestos:
    pdf.set_font(F, "B", 9.5)
    pdf.set_text_color(20, 20, 20)
    pdf.cell(W, 6, "REPUESTOS", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1)

    C = [18, 92, 35, 35]   # cant | desc | p.unit | total
    draw_table_header([
        ("Cant.",      C[0], "L"),
        ("Descripción",C[1], "L"),
        ("P. Unit.",   C[2], "R"),
        ("Total",      C[3], "R"),
    ])

    pdf.set_font(F, "", 9.5)
    pdf.set_line_width(0.1)
    pdf.set_draw_color(220, 220, 220)
    for i, item in enumerate(repuestos):
        pdf.set_fill_color(247, 247, 247) if i % 2 else pdf.set_fill_color(255, 255, 255)
        qty   = float(item.get("cantidad") or 0)
        price = float(item.get("precio_unitario") or 0)
        desc  = str(item.get("descripcion") or "")
        pdf.cell(C[0], 6.5, str(qty if qty != int(qty) else int(qty)), fill=True)
        pdf.cell(C[1], 6.5, desc, fill=True)
        pdf.cell(C[2], 6.5, fmt(price),     align="R", fill=True)
        pdf.cell(C[3], 6.5, fmt(qty*price), align="R", fill=True,
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    draw_subtotal_row("SUBTOTAL REPUESTOS:", sub_rep, W)
    pdf.ln(5)

# ══════════════════════════════════════════════════════════════════════════════
# TABLA MANO DE OBRA
# ══════════════════════════════════════════════════════════════════════════════

if mano_obra:
    pdf.set_font(F, "B", 9.5)
    pdf.set_text_color(20, 20, 20)
    pdf.cell(W, 6, "MANO DE OBRA", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1)

    C2 = [145, 35]
    draw_table_header([
        ("Descripción", C2[0], "L"),
        ("Precio",      C2[1], "R"),
    ])

    pdf.set_font(F, "", 9.5)
    for i, item in enumerate(mano_obra):
        pdf.set_fill_color(247, 247, 247) if i % 2 else pdf.set_fill_color(255, 255, 255)
        price = float(item.get("precio_unitario") or 0)
        desc  = str(item.get("descripcion") or "")
        pdf.cell(C2[0], 6.5, desc,       fill=True)
        pdf.cell(C2[1], 6.5, fmt(price), align="R", fill=True,
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    draw_subtotal_row("SUBTOTAL MANO DE OBRA:", sub_mo, W)
    pdf.ln(5)

# ══════════════════════════════════════════════════════════════════════════════
# BLOQUE TOTAL (derecha)
# ══════════════════════════════════════════════════════════════════════════════

BLOCK_W  = 95
BLOCK_X  = 15 + W - BLOCK_W
LBL_W    = BLOCK_W - 38
VAL_W    = 38

pdf.set_font(F, "", 9.5)
pdf.set_text_color(0, 0, 0)
pdf.set_fill_color(244, 244, 244)

if repuestos and mano_obra:
    pdf.set_x(BLOCK_X)
    pdf.cell(LBL_W, 6.5, "Subtotal Repuestos:",   fill=True)
    pdf.cell(VAL_W, 6.5, fmt(sub_rep), align="R", fill=True,
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_x(BLOCK_X)
    pdf.cell(LBL_W, 6.5, "Subtotal Mano de Obra:", fill=True)
    pdf.cell(VAL_W, 6.5, fmt(sub_mo), align="R",  fill=True,
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1)

pdf.set_x(BLOCK_X)
pdf.set_fill_color(22, 22, 22)
pdf.set_text_color(255, 255, 255)
pdf.set_font(F, "B", 13)
pdf.cell(LBL_W, 11, "TOTAL:",         fill=True)
pdf.cell(VAL_W, 11, fmt(total), align="R", fill=True,
         new_x=XPos.LMARGIN, new_y=YPos.NEXT)

# ─── Salida ───────────────────────────────────────────────────────────────────
sys.stdout.buffer.write(bytes(pdf.output()))
