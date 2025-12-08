import frappe
from frappe.utils import flt

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

# import frappe
# from frappe.utils import flt

# @frappe.whitelist()
# def save_melt_assay_record(data):
#     """
#     Saves Melt & Assay Record.
#     - Creates a new record if not exists for bag
#     - Updates same record on subsequent saves
#     - Accepts PARTIAL DATA (only fields sent will update)
#     """

#     if isinstance(data, str):
#         data = frappe.parse_json(data)

#     bag_id = data.get("source_bag")
#     if not bag_id:
#         frappe.throw("source_bag is required.")

#     # 1️⃣ FIND EXISTING DOCUMENT FOR THIS BAG
#     existing = frappe.db.get_value(
#         "Melt And Assay Record",
#         {"source_bag": bag_id},
#         "name"
#     )

#     if existing:
#         doc = frappe.get_doc("Melt And Assay Record", existing)
#         is_new = False
#     else:
#         doc = frappe.new_doc("Melt And Assay Record")
#         doc.source_bag = bag_id
#         is_new = True

#     # ============================================================
#     # 2️⃣ UPDATE MAIN FIELDS (only if provided)
#     # ============================================================

#     simple_fields = [
#         # Bag Summary
#         "total_weight_g", "pure_gold_xau_g", "average_purity",
#         "total_cost_basis", "cost_per_gram", "record_id", "record_date",

#         # Melting
#         "pre_melt_weight", "post_melt_weight", "weight_loss_g",
#         "weight_loss_pct", "melting_cost_rm", "melting_date",

#         # Assay
#         "est_purity_from_bag", "actual_purity", "purity_variance",
#         "actual_xau_g", "assay_cost_rm", "assay_date",

#         # Refining
#         "refine_to_9999", "target_purity", "post_refining_weight",
#         "refining_cost_rm", "refining_date",

#         # Buyer Info
#         "buyer", "buyer_contact",

#         # Sale Details
#         "final_weight_g", "final_purity", "final_xau_g",
#         "locked_rate_rm_per_xau", "gross_sale_value_rm", "payment_term",

#         # Payments Summary
#         "total_paid_rm", "balance_due_rm",

#         # Metrics
#         "metrics_pre_melt_weight_g", "metrics_post_melt_weight_g",
#         "metrics_loss_g", "metrics_loss_pct", "metrics_est_purity",
#         "metrics_actual_purity", "metrics_variance", "metrics_status",

#         "xau_before_est", "xau_after_actual", "net_xau_change_g",
#         "net_xau_change_pct", "analysis_text",

#         "original_cost_rm", "total_cost_basis_rm", "gross_sale_value_rm",
#         "hedge_pl_rm", "gross_margin_rm", "net_profit_rm",
#         "gross_margin_pct", "net_profit_pct", "gross_margin_per_g",
#         "net_profit_per_g",

#         "insight_1", "insight_2", "insight_3",
#     ]

#     for field in simple_fields:
#         if field in data:
#             doc.set(field, data.get(field))

#     # ============================================================
#     # 3️⃣ UPDATE CHILD TABLE — Bag Items
#     # ============================================================
#     if "bag_items" in data:
#         doc.set("bag_items", [])
#         for row in data["bag_items"]:
#             doc.append("bag_items", {
#                 "purity": row.get("purity"),
#                 "weight_g": row.get("weight_g"),
#                 "xau_g": row.get("xau_g"),
#                 "cost_rm": row.get("cost_rm"),
#                 "cost_per_g_rm": row.get("cost_per_g_rm")
#             })

#     # ============================================================
#     # 4️⃣ UPDATE CHILD TABLE — Payments
#     # ============================================================
#     if "payments" in data:
#         doc.set("payments", [])
#         for p in data["payments"]:
#             doc.append("payments", {
#                 "payment_date": p.get("payment_date"),
#                 "payment_type": p.get("payment_type"),
#                 "amount_rm": p.get("amount_rm"),
#                 "reference": p.get("reference")
#             })

#     # ============================================================
#     # 5️⃣ SAVE DOCUMENT
#     # ============================================================
#     doc.save(ignore_permissions=True)

#     frappe.db.commit()

#     return {
#         "status": "success",
#         "docname": doc.name,
#         "is_new": is_new,
#         "message": "Record saved successfully"
#     }
