import frappe
import json
from frappe import _

@frappe.whitelist()
def get_summary(dealer=None):
    user = frappe.session.user
    roles = frappe.get_roles(user)

    filters = {"docstatus": ["<", 2]}
    if dealer:
        filters["dealer"] = dealer

    if "System Manager" not in roles and user != "Administrator":
        filters["assigned_to"] = user

    records = frappe.get_all(
        "Item Pickup",
        fields=["dealer", "purity", "is_pickup", "total_weight", "avco_rate", "amount"],
        filters=filters,
        ignore_permissions=False
    )

    summary = {}
    for r in records:
        key = (r.dealer, r.purity, r.is_pickup)
        if key not in summary:
            summary[key] = {
                "dealer": r.dealer,
                "purity": r.purity,
                "is_pickup": r.is_pickup,
                "total_weight": 0,
                "avco_rate_list": [],
                "amount": 0
            }
        summary[key]["total_weight"] += r.total_weight or 0
        summary[key]["avco_rate_list"].append(r.avco_rate or 0)
        summary[key]["amount"] += r.amount or 0

    result = []
    for k, v in summary.items():
        avg_rate = 0
        if v["avco_rate_list"]:
            avg_rate = round(sum(v["avco_rate_list"]) / len(v["avco_rate_list"]), 2)
        result.append({
            "dealer": v["dealer"],
            "purity": v["purity"],
            "is_pickup": v["is_pickup"],
            "total_weight": v["total_weight"],
            "avco_rate": avg_rate,
            "amount": v["amount"]
        })

    result.sort(key=lambda x: (x["dealer"], x["purity"], x["is_pickup"]))
    return result

@frappe.whitelist()
def get_items(dealer, purity, is_pickup=None):
    user = frappe.session.user
    roles = frappe.get_roles(user)

    filters = {"dealer": dealer, "purity": purity, "docstatus": ["<", 2]}
    if is_pickup is not None and str(is_pickup) != "":
        filters["is_pickup"] = int(is_pickup)

    if "System Manager" not in roles and user != "Administrator":
        filters["assigned_to"] = user

    return frappe.get_all(
        "Item Pickup",
        fields=[
            "name", "date", "item_code", "total_weight", "avco_rate",
            "amount", "purchase_receipt", "assigned_to", "is_pickup"
        ],
        filters=filters,
        order_by="date desc, name desc",
        ignore_permissions=False
    )

@frappe.whitelist()
def bulk_update_pickup(docnames, is_pickup=None, assigned_to=None):
    if isinstance(docnames, str):
        try:
            docnames = json.loads(docnames)
        except Exception:
            docnames = [docnames]

    updated, skipped, errors = [], [], []

    for name in docnames:
        try:
            doc = frappe.get_doc("Item Pickup", name)
            if doc.docstatus != 0:
                skipped.append({"name": name, "reason": f"docstatus={doc.docstatus}"})
                continue
            if not doc.has_permission("write"):
                skipped.append({"name": name, "reason": "no write permission"})
                continue

            if is_pickup is not None:
                doc.is_pickup = bool(int(is_pickup))
            if assigned_to:
                doc.assigned_to = assigned_to

            doc.save()
            updated.append(name)

        except Exception:
            errors.append({"name": name, "trace": frappe.get_traceback()})

    frappe.db.commit()
    return {
        "updated": len(updated),
        "updated_list": updated,
        "skipped": skipped,
        "errors": errors
    }
