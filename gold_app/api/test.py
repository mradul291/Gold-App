import frappe
from frappe import _
from frappe.utils import flt, nowdate
from erpnext.accounts.party import get_party_account
from erpnext.controllers.accounts_controller import (
    get_advance_journal_entries,
    get_advance_payment_entries_for_regional,
)

@frappe.whitelist()
def get_bag_overview():
    """
    Returns dynamic bag overview for UI (main grid)
    Includes:
        - total_weight
        - avg_purity
        - total_cost
        - cost_per_gram
        - xau_g (calculated pure gold)
    """

    rows = frappe.db.sql("""
        SELECT
            bin.warehouse AS bag_id,
            item.purity AS purity,
            SUM(bin.actual_qty) AS weight,
            AVG(bin.valuation_rate) AS rate,
            SUM(bin.actual_qty * bin.valuation_rate) AS amount
        FROM `tabBin` bin
        JOIN `tabItem` item
            ON item.name = bin.item_code
        JOIN `tabWarehouse` wh
            ON wh.name = bin.warehouse
        WHERE wh.parent_warehouse = 'Wholesale - AGSB'
            AND bin.actual_qty > 0 
        GROUP BY bin.warehouse, item.purity
        HAVING SUM(bin.actual_qty) > 0
    """, as_dict=True)

    bags = {}

    for r in rows:
        bag = bags.setdefault(r.bag_id, {
            "bag_id": r.bag_id,
            "total_weight": 0,
            "avg_purity": 0,
            "total_cost": 0,
            "cost_per_gram": 0,
            "xau_g": 0,
            "purities": []
        })

        purity = flt(r.purity)
        weight = flt(r.weight)
        rate = flt(r.rate)
        amount = flt(r.amount)

        purity_decimal = purity / 1000
        xau = weight * purity_decimal

        bag["purities"].append({
            "purity": purity,
            "weight": weight,
            "rate": rate,
            "xau": xau
        })

        bag["total_weight"] += weight
        bag["total_cost"] += amount
        bag["xau_g"] += xau

    final_list = []
    for bag in bags.values():
        total_weight = bag["total_weight"]
        total_cost = bag["total_cost"]

        total_purity_weight = sum(p["purity"] * p["weight"] for p in bag["purities"])
        avg_purity = (total_purity_weight / total_weight) if total_weight else 0

        bag["avg_purity"] = round(avg_purity, 2)
        bag["total_weight"] = round(total_weight, 2)
        bag["total_cost"] = round(total_cost, 2)
        bag["cost_per_gram"] = round(total_cost / total_weight, 2) if total_weight else 0
        bag["xau_g"] = round(bag["xau_g"], 3)

        final_list.append(bag)

    return final_list

@frappe.whitelist()
def get_bag_details(bag_id):
    """
    Returns summary + items of selected bag.
    XAU is calculated: weight * (purity / 1000)
    """

    rows = frappe.db.sql("""
        SELECT
            item.purity,
            SUM(bin.actual_qty) AS weight,
            AVG(bin.valuation_rate) AS rate,
            SUM(bin.actual_qty * bin.valuation_rate) AS amount
        FROM `tabBin` bin
        JOIN `tabItem` item ON item.name = bin.item_code
        WHERE bin.warehouse = %s
          AND bin.actual_qty > 0
        GROUP BY item.purity
    """, (bag_id,), as_dict=True)

    if not rows:
        return {
            "summary": {},
            "items": []
        }

    total_weight = sum(flt(r.weight) for r in rows)
    total_cost = sum(flt(r.amount) for r in rows)

    total_purity_weight = sum(flt(r.purity) * flt(r.weight) for r in rows)
    avg_purity = (total_purity_weight / total_weight) if total_weight else 0

    # calculate total XAU
    total_xau = sum(flt(r.weight) * (flt(r.purity) / 1000) for r in rows)

    summary = {
        "source_bag": bag_id,
        "total_weight_g": round(total_weight, 2),
        "pure_gold_xau_g": round(total_xau, 3),
        "average_purity": round(avg_purity, 2),
        "total_cost_basis": round(total_cost, 2),
        "cost_per_gram": round(total_cost / total_weight, 2) if total_weight else 0,

        # UI fields (uncalculated here)
        "record_id": "",
        "record_date": ""
    }

    items = []
    for r in rows:
        purity = flt(r.purity)
        weight = flt(r.weight)
        rate = flt(r.rate)
        amount = flt(r.amount)
        xau = weight * (purity / 1000)

        items.append({
            "purity": purity,
            "weight_g": weight,
            "xau_g": round(xau, 3),
            "cost_rm": amount,
            "cost_per_g_rm": rate
        })

    return {
        "summary": summary,
        "items": items
    }

@frappe.whitelist()
def save_melt_assay_sales(payload):
	"""
	Create or Update Melt and Assay Sales document
	- If payload.name exists -> update
	- Else -> create new
	"""

	if isinstance(payload, str):
		payload = frappe.parse_json(payload)

	docname = payload.get("name")
	header = payload.get("header", {})
	bag_contents = payload.get("bag_contents", [])
	locked_rates = payload.get("locked_rates", [])
	payments = payload.get("payments", [])

	# ----------------------------------------
	# CREATE OR FETCH DOCUMENT
	# ----------------------------------------
	if docname:
		doc = frappe.get_doc("Melt and Assay Sales", docname)
	else:
		doc = frappe.new_doc("Melt and Assay Sales")
		doc.posting_date = nowdate()

	# ----------------------------------------
	# SET PARENT FIELDS
	# ----------------------------------------
	set_parent_fields(doc, header)

	# ----------------------------------------
	# RESET & APPEND BAG CONTENTS
	# ----------------------------------------
	doc.set("bag_contents", [])
	for row in bag_contents:
		doc.append("bag_contents", {
			"purity": row.get("purity"),
			"weight": flt(row.get("weight")),
			"avco": flt(row.get("avco")),
			"cost": flt(row.get("cost")),
			"xau": flt(row.get("xau")),
			"xau_avco": flt(row.get("xau_avco")),
		})

	# ----------------------------------------
	# RESET & APPEND LOCKED RATES
	# ----------------------------------------
	doc.set("locked_rates", [])
	for row in locked_rates:
		doc.append("locked_rates", {
			"price_per_xau": flt(row.get("price_per_xau")),
			"xau_weight": flt(row.get("xau_weight")),
			"amount": flt(row.get("amount")),
			"remark": row.get("remark"),
		})

	# ----------------------------------------
	# RESET & APPEND PAYMENTS
	# ----------------------------------------
	doc.set("payments", [])
	for row in payments:
		doc.append("payments", {
			"payment_date": row.get("payment_date"),
			"payment_method": row.get("payment_method"),
			"amount": flt(row.get("amount")),
			"reference_no": row.get("reference_no"),
			"status": row.get("status"),
		})

	# ----------------------------------------
	# SAVE DOCUMENT
	# ----------------------------------------
	doc.save(ignore_permissions=True)
	frappe.db.commit()

	return {
		"name": doc.name,
		"message": "Melt and Assay Sales saved successfully"
	}

def set_parent_fields(doc, data):
	"""
	Map all parent fields from UI payload to DocType
	"""

	parent_fields = [
		# Bag Summary
		"total_weight", "avg_purity", "total_xau", "total_cost", "xau_avco",

		# Melting
		"weight_before_melting", "weight_after_melting", "melting_cost",
		"melting_payment_mode", "weight_loss", "xau_loss", "loss_percentage",

		# Assay
		"current_avg_purity", "assay_purity", "purity_variance",
		"xau_weight_variance", "actual_xau_weight", "assay_sample_weight",
		"net_xau_sellable", "assay_cost", "assay_payment_mode",

		# Sales
		"customer",
		"customer_id_number",
		"sale_net_weight", "sale_assay_purity", "sale_net_xau",
		"total_xau_sold", "total_revenue", "weighted_avg_rate",

		# Payments Summary
		"total_amount",
		"amount_paid",
		"balance_due",
		"customer_advance_balance",

		# Metrics - Weight & Purity
		"m_original_gross_weight", "m_weight_after_melting", "m_weight_loss",
		"m_weight_loss_percentage", "m_xau_weight_loss", "m_net_weight_sale",
		"m_original_avg_purity", "m_assay_purity", "m_purity_variance",
		"m_xau_weight_variance",

		# Metrics - Cost
		"m_original_gold_cost", "m_melting_cost", "m_assay_cost",
		"m_total_cost",

		# Metrics - Revenue
		"m_total_revenue", "m_total_cost_profit",
		"m_gross_profit", "m_profit_margin",

		# Metrics - Efficiency
		"m_melting_efficiency", "m_xau_recovery",
		"m_net_sellable", "m_profit_per_xau",

		# Vs Last Sale
		"vs_weight_loss_percentage", "vs_xau_recovery_rate",
		"vs_purity_variance", "vs_net_sellable_percentage",
		"vs_profit_margin",
	]

	for field in parent_fields:
		doc.set(field, data.get(field) or 0)

@frappe.whitelist()
def get_resume_data(log_id):
	"""
	Return all data needed to restore Melt and Assay Sales
	"""

	if not log_id:
		frappe.throw(_("log_id is required"))

	try:
		doc = frappe.get_doc("Melt and Assay Sales", log_id)
	except Exception as e:
		frappe.throw(_("Cannot load document: {0}").format(str(e)))

	# ----------------------------------------
	# PARENT FIELDS
	# ----------------------------------------
	header = {}
	parent_fields = [
		# Bag Summary
		"total_weight", "avg_purity", "total_xau", "total_cost", "xau_avco",

		# Melting
		"weight_before_melting", "weight_after_melting", "melting_cost",
		"melting_payment_mode", "weight_loss", "xau_loss", "loss_percentage",

		# Assay
		"current_avg_purity", "assay_purity", "purity_variance",
		"xau_weight_variance", "actual_xau_weight", "assay_sample_weight",
		"net_xau_sellable", "assay_cost", "assay_payment_mode",

		# Sales
		"customer",
		"customer_id_number",
		"sale_net_weight", "sale_assay_purity", "sale_net_xau",
		"total_xau_sold", "total_revenue", "weighted_avg_rate",

		# Payments Summary
		"total_amount",
		"amount_paid",
		"balance_due",
		"customer_advance_balance",

		# Metrics
		"m_original_gross_weight", "m_weight_after_melting", "m_weight_loss",
		"m_weight_loss_percentage", "m_xau_weight_loss", "m_net_weight_sale",
		"m_original_avg_purity", "m_assay_purity", "m_purity_variance",
		"m_xau_weight_variance", "m_original_gold_cost", "m_melting_cost",
		"m_assay_cost", "m_total_cost", "m_total_revenue",
		"m_total_cost_profit", "m_gross_profit", "m_profit_margin",
		"m_melting_efficiency", "m_xau_recovery",
		"m_net_sellable", "m_profit_per_xau",

		# Vs Last Sale
		"vs_weight_loss_percentage", "vs_xau_recovery_rate",
		"vs_purity_variance", "vs_net_sellable_percentage",
		"vs_profit_margin",
	]

	for f in parent_fields:
		header[f] = doc.get(f)

	# ----------------------------------------
	# BAG CONTENTS
	# ----------------------------------------
	bag_contents = []
	for row in doc.get("bag_contents") or []:
		bag_contents.append({
			"purity": row.purity,
			"weight": row.weight,
			"avco": row.avco,
			"cost": row.cost,
			"xau": row.xau,
			"xau_avco": row.xau_avco,
		})

	# ----------------------------------------
	# LOCKED RATES
	# ----------------------------------------
	locked_rates = []
	for row in doc.get("locked_rates") or []:
		locked_rates.append({
			"price_per_xau": row.price_per_xau,
			"xau_weight": row.xau_weight,
			"amount": row.amount,
			"remark": row.remark,
		})

	# ----------------------------------------
	# PAYMENTS
	# ----------------------------------------
	payments = []
	for row in doc.get("payments") or []:
		payments.append({
			"payment_date": row.payment_date,
			"payment_method": row.payment_method,
			"amount": row.amount,
			"reference_no": row.reference_no,
			"status": row.status,
		})

	return {
		"name": doc.name,
		"header": header,
		"bag_contents": bag_contents,
		"locked_rates": locked_rates,
		"payments": payments,
	}

@frappe.whitelist()
def create_purity_and_unsorted_item(purity):
    if not purity:
        frappe.throw("Purity is required")

    purity = float(purity)
    purity_name = str(purity)
    item_code = f"Unsorted-{purity_name}"

    # -------------------------
    # Create Purity (if missing)
    # -------------------------
    if not frappe.db.exists("Purity", purity_name):
        purity_doc = frappe.new_doc("Purity")
        purity_doc.purity_name = purity_name
        purity_doc.insert(ignore_permissions=True)

    # -------------------------
    # Create Item (if missing)
    # -------------------------
    if not frappe.db.exists("Item", item_code):
        item = frappe.new_doc("Item")
        item.item_code = item_code
        item.item_name = item_code
        item.item_group = "MG - Mixed Gold"
        item.stock_uom = "Gram"
        item.purity = purity
        item.is_stock_item = 1
        item.insert(ignore_permissions=True)

    frappe.db.commit()

    return {
        "status": "success",
        "purity": purity_name,
        "item_code": item_code
    }

@frappe.whitelist()
def create_repack_stock_entry(
    source_items,
    finished_item_code,
    s_warehouse,
    t_warehouse
):
    if not source_items:
        frappe.throw("Source items are required")

    if not finished_item_code:
        frappe.throw("Finished item purity is required")

    # Parse source items
    source_items = frappe.parse_json(source_items)

    se = frappe.new_doc("Stock Entry")
    se.stock_entry_type = "Repack"

    total_finished_qty = 0

    # -------------------------
    # Source Items (Consumed)
    # -------------------------
    for row in source_items:
        purity = row.get("item_code")
        qty = row.get("qty", 0)

        if not purity or not qty:
            frappe.throw("Each source item must have purity and qty")

        item_code = f"Unsorted-{purity}"

        se.append("items", {
            "item_code": item_code,
            "qty": qty,
            "s_warehouse": s_warehouse,
        })

        total_finished_qty += qty

    # -------------------------
    # Finished Item (Produced)
    # -------------------------
    finished_item_code = f"Unsorted-{finished_item_code}"

    se.append("items", {
        "item_code": finished_item_code,
        "qty": total_finished_qty,
        "t_warehouse": t_warehouse,
        "is_finished_item": 1
    })

    se.insert(ignore_permissions=True)
    se.submit()

    return {
        "status": "success",
        "stock_entry": se.name,
        "finished_qty": total_finished_qty
    }

@frappe.whitelist()
def get_customer_advance_balance(customer, company=None):
    """
    Return total advance balance for a Customer (sum of available advances).
    Used only to show a single number on Wholesale Bag Direct Payment page.
    """
    if not customer:
        return {"status": "error", "message": "Customer is required.", "advance_balance": 0}

    if not company:
        company = frappe.defaults.get_user_default("Company")

    party_type = "Customer"
    party = customer
    amount_field = "credit_in_account_currency"  # for Customer advances
    order_doctype = "Sales Order"
    order_list = []  # not linking to specific SO here

    # Get party account list including advance accounts
    party_accounts = get_party_account(
        party_type, party=party, company=company, include_advance=True
    )

    party_account = []
    default_advance_account = None

    if party_accounts:
        party_account.append(party_accounts[0])
        if len(party_accounts) == 2:
            default_advance_account = party_accounts[1]

    # Advances from Journal Entries
    journal_entries = get_advance_journal_entries(
        party_type,
        party,
        party_account,
        amount_field,
        order_doctype,
        order_list,
        include_unallocated=True,
    )

    # Advances from Payment Entries
    payment_entries = get_advance_payment_entries_for_regional(
        party_type,
        party,
        party_account,
        order_doctype,
        order_list,
        default_advance_account,
        include_unallocated=True,
    )

    total_advance = 0
    for d in journal_entries + payment_entries:
        total_advance += flt(d.amount)

    return {
        "status": "success",
        "customer": customer,
        "company": company,
        "advance_balance": flt(total_advance),
    }

@frappe.whitelist()
def create_sales_invoice(customer, items, posting_date=None):
	if not customer:
		frappe.throw("Customer is required")

	if isinstance(items, str):
		items = frappe.parse_json(items)

	if not items:
		frappe.throw("At least one item is required")

	company = frappe.defaults.get_user_default("Company")

	si = frappe.new_doc("Sales Invoice")
	si.customer = customer
	si.company = company
	si.posting_date = posting_date or nowdate()
	si.update_stock = 1

	for row in items:
		qty = flt(row.get("qty"))

		si.append("items", {
			"item_code": row.get("item_code"),
			"qty": qty,
			"weight_per_unit": qty,
			"rate": flt(row.get("rate")),
		})

	si.insert(ignore_permissions=True)
	frappe.db.commit()        

	return {
		"status": "success",
		"sales_invoice": si.name
	}
