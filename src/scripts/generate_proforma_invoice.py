#!/usr/bin/env python3
"""
Production-style Proforma Invoice PDF Generator
Matches the reference layout: A4 portrait, minimal corporate design, QR verification,
buyer/project split, product table, bank details, totals, signature, and footer.

Install:
    pip install reportlab qrcode[pil] pillow

Run:
    python generate_proforma_invoice.py [optional_data.json] [optional_output.pdf]
"""

from __future__ import annotations

import sys
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Dict, List
import tempfile

import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


PAGE_W, PAGE_H = A4


def money(value: Decimal | float | int) -> str:
    value = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{value:,.2f}"


def as_decimal(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class ProformaInvoiceGenerator:
    MARGIN = 28
    DARK = colors.HexColor("#20242A")
    LINE = colors.HexColor("#70757A")
    LIGHT = colors.HexColor("#F5F6F7")

    def __init__(self, data: Dict[str, Any]):
        self.data = data
        self.totals = self.calculate_totals()

    # ---------------- CALCULATIONS ----------------

    def calculate_totals(self) -> Dict[str, Decimal]:
        subtotal = Decimal("0.00")
        cgst = Decimal("0.00")
        sgst = Decimal("0.00")
        igst = Decimal("0.00")

        for item in self.data.get("items", []):
            qty = as_decimal(item.get("qty", item.get("quantity", 0)))
            rate = as_decimal(item.get("rate", item.get("unitPrice", item.get("unitRate", 0))))
            basic = (qty * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            subtotal += basic

            gst_percent = as_decimal(item.get("gst_percent", item.get("gstRate", 18)))
            tax_type = str(item.get("tax_type", "split")).lower()

            if tax_type == "igst":
                igst += (basic * gst_percent / 100).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            else:
                half = gst_percent / 2
                cgst += (basic * half / 100).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                sgst += (basic * half / 100).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )

        gst_total = cgst + sgst + igst
        grand_total = subtotal + gst_total

        advance_percent = as_decimal(
            self.data.get("invoice", {}).get("advance_percent", self.data.get("advancePercentage", 50))
        )
        advance = (grand_total * advance_percent / 100).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        balance = grand_total - advance

        return {
            "subtotal": subtotal,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "gst_total": gst_total,
            "grand_total": grand_total,
            "advance": advance,
            "balance": balance,
            "advance_percent": advance_percent,
        }

    # ---------------- DRAWING HELPERS ----------------

    def line(self, c, x1, y1, x2, y2, width=0.8):
        c.setStrokeColor(self.LINE)
        c.setLineWidth(width)
        c.line(x1, y1, x2, y2)

    def text(self, c, x, y, value, size=9, bold=False, color=None):
        c.setFillColor(color or self.DARK)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(x, y, str(value))

    def right_text(self, c, right_x, y, value, size=9, bold=False):
        font = "Helvetica-Bold" if bold else "Helvetica"
        c.setFillColor(self.DARK)
        c.setFont(font, size)
        c.drawRightString(right_x, y, str(value))

    def center_text(self, c, x1, x2, y, value, size=9, bold=False):
        font = "Helvetica-Bold" if bold else "Helvetica"
        c.setFillColor(self.DARK)
        c.setFont(font, size)
        width = stringWidth(str(value), font, size)
        c.drawString((x1 + x2 - width) / 2, y, str(value))

    def wrap_lines(self, text: str, font: str, size: float, max_width: float) -> List[str]:
        words = str(text or "").split()
        if not words:
            return [""]
        lines, current = [], ""
        for word in words:
            candidate = word if not current else current + " " + word
            if stringWidth(candidate, font, size) <= max_width:
                current = candidate
            else:
                lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines

    def draw_wrapped(self, c, x, y, value, max_width, size=9, bold=False, leading=None):
        font = "Helvetica-Bold" if bold else "Helvetica"
        leading = leading or size * 1.55
        lines = self.wrap_lines(value, font, size, max_width)
        c.setFont(font, size)
        c.setFillColor(self.DARK)
        for line in lines:
            c.drawString(x, y, line)
            y -= leading
        return y

    # ---------------- QR ----------------

    def make_qr(self) -> str:
        invoice = self.data.get("invoice", self.data)
        content = invoice.get(
            "verification_url",
            invoice.get("verificationUrl", f"PI:{invoice.get('pi_number', invoice.get('piNumber', ''))}")
        )
        img = qrcode.make(content)
        path = Path(tempfile.gettempdir()) / f"qr_{invoice.get('pi_number', invoice.get('piNumber', 'invoice'))}.png"
        img.save(path)
        return str(path)

    # ---------------- SECTIONS ----------------

    def draw_header(self, c, y):
        company = self.data.get("company", self.data.get("facility", {}))
        invoice = self.data.get("invoice", self.data)

        logo_path = company.get("logo")
        if logo_path and Path(logo_path).exists():
            c.drawImage(
                logo_path, self.MARGIN + 8, y - 54,
                width=54, height=54,
                preserveAspectRatio=True, mask="auto"
            )
        else:
            c.rect(self.MARGIN + 8, y - 54, 54, 54)
            self.center_text(c, self.MARGIN + 8, self.MARGIN + 62, y - 34, "LOGO", 8, True)

        left_x = self.MARGIN + 74
        self.text(c, left_x, y - 8, company.get("name", "Pacific Products and Solutions"), 13, True)

        yy = y - 28
        address_lines = company.get("address", [
            "H-3, J.R. Complex Gate No 4, Mela Ram Farm,",
            "Mandoli, Delhi 110093, India"
        ])
        if isinstance(address_lines, str):
            address_lines = [address_lines]

        for line in address_lines:
            self.text(c, left_x, yy, line, 8.5)
            yy -= 16

        self.text(c, left_x, yy - 2, f"GSTIN: {company.get('gstin', '07AADFP3948F1Z1')}", 8.5)
        self.text(c, left_x, yy - 22, f"Email: {company.get('email', 'billing@pacifichardware.com')}", 8.5)

        phone = company.get("phone", "+91 98185 92113")
        website = company.get("website", "www.pacifichardware.com")
        self.text(c, left_x, yy - 42, f"Phone: {phone}  |  Website: {website}", 8.5)

        qr_path = self.make_qr()
        qr_size = 66
        qr_x = PAGE_W - self.MARGIN - qr_size - 18
        c.drawImage(qr_path, qr_x, y - 58, qr_size, qr_size)
        self.center_text(c, qr_x, qr_x + qr_size, y - 72, "QR VERIFICATION", 7.5)

        pi_num = invoice.get("pi_number", invoice.get("piNumber", ""))
        self.right_text(
            c, PAGE_W - self.MARGIN,
            y - 94,
            f"PI No.: {pi_num}",
            10.5, True
        )

        separator_y = y - 114
        self.line(c, self.MARGIN, separator_y, PAGE_W - self.MARGIN, separator_y, 1.2)
        return separator_y

    def draw_title(self, c, y):
        invoice = self.data.get("invoice", self.data)

        self.text(c, self.MARGIN + 2, y - 34, "PROFORMA INVOICE", 19, True)

        label_x = PAGE_W - 195
        value_x = PAGE_W - self.MARGIN - 8

        issue_date = invoice.get("issue_date", invoice.get("issueDate", invoice.get("createdAt", "")))
        fy = invoice.get("financial_year", invoice.get("financialYear", "2026-2027"))

        self.text(c, label_x, y - 18, "Issue Date", 8.5)
        self.text(c, label_x + 75, y - 18, ":", 8.5)
        self.right_text(c, value_x, y - 18, str(issue_date)[:10], 9.5)

        self.text(c, label_x, y - 38, "Financial Year", 8.5)
        self.text(c, label_x + 75, y - 38, ":", 8.5)
        self.right_text(c, value_x, y - 38, str(fy), 9.5)

        bottom = y - 64
        self.line(c, self.MARGIN - 6, bottom, PAGE_W - self.MARGIN, bottom, 0.9)
        return bottom

    def draw_party_details(self, c, y):
        buyer = self.data.get("buyer", {
            "name": self.data.get("customerName", ""),
            "company": self.data.get("companyName", ""),
            "gstin": self.data.get("customerGstin", self.data.get("gstin", "")),
            "email": self.data.get("customerEmail", ""),
            "phone": self.data.get("customerPhone", ""),
            "address": self.data.get("billingAddress", ""),
        })
        invoice = self.data.get("invoice", self.data)
        delivery = self.data.get("delivery", {
            "address": self.data.get("shippingAddress", self.data.get("billingAddress", ""))
        })

        x0 = self.MARGIN + 2
        split = PAGE_W / 2 - 3
        right_x = split + 12
        bottom = y - 168

        self.line(c, split, y, split, bottom, 0.7)

        self.text(c, x0, y - 25, "BILL TO (BUYER)", 8.5, True)
        yy = y - 47
        self.text(c, x0, yy, buyer.get("name", ""), 10, True)
        yy -= 21

        if buyer.get("company") and buyer.get("company") != buyer.get("name"):
            self.text(c, x0, yy, buyer["company"], 8.5)
            yy -= 20

        if buyer.get("gstin"):
            self.text(c, x0, yy, f"GSTIN: {buyer['gstin']}", 8.5)
            yy -= 20

        contact = buyer.get("email", "")
        if buyer.get("phone"):
            contact += f"  |  Ph: {buyer['phone']}"
        self.text(c, x0, yy, contact, 8.5)
        yy -= 25

        self.text(c, x0, yy, "Billing Address:", 8.5, True)
        yy -= 19
        buyer_addr = buyer.get("address", [])
        if isinstance(buyer_addr, str):
            buyer_addr = [buyer_addr]
        for line in buyer_addr:
            self.text(c, x0, yy, line, 8.5)
            yy -= 17

        self.text(c, right_x, y - 25, "ORDER & PROJECT DETAILS", 8.5, True)

        order_type = invoice.get("order_type", invoice.get("orderType", "Commercial Supply Order"))
        fy = invoice.get("financial_year", invoice.get("financialYear", "2026-2027"))
        pi_num = invoice.get("pi_number", invoice.get("piNumber", ""))
        pay_terms = invoice.get("payment_terms", invoice.get("paymentTerms", "50% Advance, Balance at Dispatch"))

        rows = [
            ("Order Type", order_type),
            ("FY", fy),
            ("PI Number", pi_num),
            ("Payment Terms", pay_terms),
        ]

        yy = y - 47
        for label, value in rows:
            self.text(c, right_x, yy, label, 8.5)
            self.text(c, right_x + 82, yy, ":", 8.5)
            self.draw_wrapped(c, right_x + 96, yy, str(value), PAGE_W - self.MARGIN - (right_x + 96), 8.5)
            yy -= 21

        self.text(c, right_x, yy, "Delivery Address", 8.5)
        self.text(c, right_x + 82, yy, ":", 8.5)
        deliv_addr = delivery.get("address", [])
        if isinstance(deliv_addr, list):
            deliv_addr = " ".join(deliv_addr)
        self.draw_wrapped(
            c, right_x + 96, yy,
            str(deliv_addr),
            PAGE_W - self.MARGIN - (right_x + 96),
            8.5
        )

        return bottom - 22

    def draw_items_table(self, c, y):
        x = self.MARGIN - 6
        widths = [34, 190, 68, 48, 52, 72, 68, 73]
        total_w = sum(widths)

        header_h = 30
        row_h = 48
        items = self.data.get("items", [])

        c.setFillColor(self.LIGHT)
        c.rect(x, y - header_h, total_w, header_h, fill=1, stroke=0)

        headers = [
            "#", "DESCRIPTION / PRODUCT SPECIFICATION", "HSN / SAC",
            "UNIT", "QTY", "RATE (₹)", "GST (₹)", "TOTAL (₹)"
        ]

        cx = x
        for i, w in enumerate(widths):
            c.setStrokeColor(self.LINE)
            c.rect(cx, y - header_h, w, header_h, fill=0, stroke=1)
            self.center_text(c, cx, cx + w, y - 19, headers[i], 7.4, True)
            cx += w

        current_y = y - header_h

        for index, item in enumerate(items, start=1):
            current_y -= row_h
            cx = x
            for w in widths:
                c.setStrokeColor(self.LINE)
                c.rect(cx, current_y, w, row_h, fill=0, stroke=1)
                cx += w

            qty = as_decimal(item.get("qty", item.get("quantity", 0)))
            rate = as_decimal(item.get("rate", item.get("unitPrice", item.get("unitRate", 0))))
            basic = (qty * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            gst_pct = as_decimal(item.get("gst_percent", item.get("gstRate", 18)))
            gst = (basic * gst_pct / 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            total = basic + gst

            positions = []
            p = x
            for w in widths:
                positions.append((p, p + w))
                p += w

            self.center_text(c, *positions[0], current_y + 20, index, 8.5)

            desc_x = positions[1][0] + 9
            prod_name = item.get("description", item.get("productName", "HARDWARE FITTING"))
            self.text(c, desc_x, current_y + 30, str(prod_name), 8.5, True)
            sku = item.get("sku", "")
            if sku:
                self.text(c, desc_x, current_y + 14, f"SKU: {sku}", 7.2)

            self.center_text(c, *positions[2], current_y + 20, item.get("hsn", item.get("hsnCode", "83024110")), 8.5)
            self.center_text(c, *positions[3], current_y + 20, item.get("unit", "PCS"), 8.5)
            self.center_text(c, *positions[4], current_y + 20, str(qty), 8.5)
            self.right_text(c, positions[5][1] - 8, current_y + 20, money(rate), 8.5)
            self.right_text(c, positions[6][1] - 8, current_y + 20, money(gst), 8.5)
            self.right_text(c, positions[7][1] - 8, current_y + 20, money(total), 8.5)

        return current_y - 25

    def draw_bottom(self, c, y):
        bank = self.data.get("bank", self.data.get("bankDetails", {}))
        signatory = self.data.get("signatory", {})
        x_left = self.MARGIN + 2
        x_right = PAGE_W / 2 + 17
        right_end = PAGE_W - self.MARGIN - 8

        self.text(c, x_left, y - 4, "BANK ACCOUNT DETAILS FOR RTGS / NEFT / IMPS", 8.5, True)

        bank_rows = [
            ("Bank Name", bank.get("bank_name", bank.get("bankName", "HDFC Bank Ltd."))),
            ("Account Name", bank.get("account_name", bank.get("accountName", "Pacific Products and Solutions"))),
            ("Account No.", bank.get("account_number", bank.get("accountNumber", "50200012345678"))),
            ("IFSC Code", bank.get("ifsc", bank.get("ifscCode", "HDFC0001234"))),
            ("Branch", bank.get("branch", "Mandoli, Delhi")),
            ("UPI / VPA", bank.get("upi", bank.get("upiId", "pacificproducts@hdfcbank"))),
        ]

        yy = y - 27
        for label, value in bank_rows:
            self.text(c, x_left, yy, label, 8.5)
            self.text(c, x_left + 68, yy, ":", 8.5)
            self.text(c, x_left + 80, yy, str(value), 8.5)
            yy -= 17

        summary_y = y - 4
        summary_rows = [
            ("Taxable Value (Basic)", self.totals["subtotal"]),
        ]
        if self.totals["cgst"] > 0:
            summary_rows.append(("CGST (9%)", self.totals["cgst"]))
        if self.totals["sgst"] > 0:
            summary_rows.append(("SGST (9%)", self.totals["sgst"]))
        if self.totals["igst"] > 0:
            summary_rows.append(("IGST", self.totals["igst"]))

        for label, amount in summary_rows:
            self.text(c, x_right, summary_y, label, 8.5)
            self.right_text(c, right_end, summary_y, f"₹{money(amount)}", 8.5)
            summary_y -= 20

        self.line(c, x_right - 10, summary_y + 4, right_end + 5, summary_y + 4, 0.8)
        summary_y -= 17

        self.text(c, x_right, summary_y, "GRAND TOTAL", 10, True)
        self.right_text(c, right_end, summary_y, f"₹{money(self.totals['grand_total'])}", 10, True)

        summary_y -= 14
        self.line(c, x_right - 10, summary_y, right_end + 5, summary_y, 0.8)
        summary_y -= 21

        ap = self.totals["advance_percent"]
        self.text(c, x_right, summary_y, f"Advance Payable ({ap}%)", 8.5)
        self.right_text(c, right_end, summary_y, f"₹{money(self.totals['advance'])}", 8.5)

        summary_y -= 20
        self.text(c, x_right, summary_y, f"Balance on Dispatch ({100-ap}%)", 8.5)
        self.right_text(c, right_end, summary_y, f"₹{money(self.totals['balance'])}", 8.5)

        sig_y = min(yy - 15, summary_y - 30)
        self.text(c, x_left, sig_y, "Authorised Signatory", 8.5, True)
        company_name = self.data.get("company", {}).get("name", self.data.get("facility", {}).get("name", "Pacific Products and Solutions"))
        self.text(c, x_left, sig_y - 19, f"For {company_name}", 8.5)
        self.line(c, x_left, sig_y - 60, x_left + 135, sig_y - 60, 0.8)
        designation = signatory.get("designation", self.data.get("signedBy", "Executive Desk"))
        self.text(c, x_left, sig_y - 76, f"({designation})", 8.5)

    def draw_footer(self, c):
        invoice = self.data.get("invoice", self.data)
        y = 44
        self.line(c, self.MARGIN - 6, y, PAGE_W - self.MARGIN, y, 0.9)

        pi_num = invoice.get("pi_number", invoice.get("piNumber", ""))
        footer = f"Ref: PI #{pi_num}    |    Computer Generated"
        self.center_text(c, self.MARGIN, PAGE_W - self.MARGIN, y - 17, footer, 7.5)
        self.right_text(c, PAGE_W - self.MARGIN, y - 17, "1 / 1", 8)

    # ---------------- MAIN GENERATOR ----------------

    def generate(self, output_path: str):
        c = canvas.Canvas(output_path, pagesize=A4)
        c.setTitle(self.data.get("invoice", self.data).get("pi_number", self.data.get("piNumber", "Proforma Invoice")))
        c.setAuthor(self.data.get("company", self.data.get("facility", {})).get("name", "Pacific Products and Solutions"))

        y = PAGE_H - 38
        y = self.draw_header(c, y)
        y = self.draw_title(c, y)
        y = self.draw_party_details(c, y)
        y = self.draw_items_table(c, y)
        self.draw_bottom(c, y)
        self.draw_footer(c)

        c.showPage()
        c.save()
        return output_path


# ---------------- CLI ENTRY POINT ----------------

if __name__ == "__main__":
    import os

    data = None
    if len(sys.argv) > 1 and Path(sys.argv[1]).exists():
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            data = json.load(f)
    
    if not data:
        data = {
            "company": {
                "name": "Pacific Products and Solutions",
                "address": [
                    "H-3, J.R. Complex Gate No 4, Mela Ram Farm,",
                    "Mandoli, Delhi 110093, India",
                ],
                "gstin": "07AADFP3948F1Z1",
                "email": "billing@pacifichardware.com",
                "phone": "+91 98185 92113",
                "website": "www.pacifichardware.com",
            },
            "invoice": {
                "pi_number": "PRC-PI-2026-1652",
                "issue_date": "31 Aug 2026",
                "financial_year": "2026-2027",
                "order_type": "Commercial Supply Order",
                "payment_terms": "50% Advance, Balance at Dispatch",
                "advance_percent": 50,
                "verification_url": "https://pacifichardware.com/verify/PRC-PI-2026-1652",
            },
            "buyer": {
                "name": "Ashamin Biswas",
                "company": "abnt",
                "gstin": "DRYTFUGYIHUIK",
                "email": "ashaminbiswas7@gmail.com",
                "phone": "+91 6297676908",
                "address": [
                    "Tila Shahbazpur, Ghaziabad, nana,",
                    "Tila Shahbazpur, Uttar Pradesh - 201102",
                ],
            },
            "delivery": {
                "address": [
                    "ahammedpur sanmatinager, rghunathganj,",
                    "sanmatinager, West Bengal - 742213",
                ],
            },
            "items": [
                {
                    "description": "SS ADJUSTABLE LEG",
                    "sku": "PRC-SS-2601",
                    "hsn": "83024110",
                    "unit": "PCS",
                    "qty": 1,
                    "rate": 1100.00,
                    "gst_percent": 18,
                    "tax_type": "split",
                }
            ],
            "bank": {
                "bank_name": "HDFC Bank Ltd.",
                "account_name": "Pacific Products and Solutions",
                "account_number": "50200012345678",
                "ifsc": "HDFC0001234",
                "branch": "Mandoli, Delhi",
                "upi": "pacificproducts@hdfcbank",
            },
            "signatory": {
                "designation": "Executive Desk",
            },
        }

    output = sys.argv[2] if len(sys.argv) > 2 else f"{data.get('invoice', {}).get('pi_number', 'PRC-PI-2026-1652')}.pdf"
    generator = ProformaInvoiceGenerator(data)
    generator.generate(output)
    print(f"Generated: {output}")
