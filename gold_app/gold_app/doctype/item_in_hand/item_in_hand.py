# Copyright (c) 2025, Mradul and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate

class ItemInHand(Document):
	pass

def create_item_in_hand_entries(doc, method):
    """
    Create Item In Hand entries for Purchase Receipt items 
    only if item_availability = "Item in Hand"
    """
    if doc.item_availability != "Item in Hand":
        return

    created_entries = []

    for item in doc.items:
        in_hand_doc = frappe.new_doc("Item In Hand")
        in_hand_doc.purchase_receipt = doc.name
        in_hand_doc.dealer = doc.supplier
        in_hand_doc.date = doc.posting_date
        in_hand_doc.item_code = item.item_code
        in_hand_doc.purity = item.purity
        in_hand_doc.total_weight = item.qty
        in_hand_doc.avco_rate = item.rate
        in_hand_doc.amount = item.amount
        in_hand_doc.pooled = 0  # default unpooled

        in_hand_doc.insert(ignore_permissions=True)
        created_entries.append(in_hand_doc.name)