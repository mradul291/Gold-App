import frappe
import json
from frappe import _

# Pickup Item Admin Page(4 functions)
@frappe.whitelist()
def get_summary(dealer=None):
    user = frappe.session.user
    roles = frappe.get_roles(user)

    filters = {"docstatus": ["<", 2], "is_pickup": 0}
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
def get_dealer_summary():
    user = frappe.session.user
    roles = frappe.get_roles(user)

    filters = {"docstatus": ["<", 2], "is_pickup": 0}
    if "System Manager" not in roles and user != "Administrator":
        filters["assigned_to"] = user

    records = frappe.get_all(
        "Item Pickup",
        fields=["dealer", "purity", "total_weight", "avco_rate", "amount", "date"],
        filters=filters,
        ignore_permissions=False
    )

    summary = {}
    for r in records:
        if not r.dealer:
            continue
        if r.dealer not in summary:
            summary[r.dealer] = {
                "dealer": r.dealer,
                "total_weight": 0,
                "amount": 0,
                "purities": set(),
                "avco_rate_list": [],
                "dates": []
            }
        summary[r.dealer]["total_weight"] += r.total_weight or 0
        summary[r.dealer]["amount"] += r.amount or 0
        summary[r.dealer]["purities"].add(r.purity or "")
        if r.avco_rate:
            summary[r.dealer]["avco_rate_list"].append(r.avco_rate)
        if r.date:
            summary[r.dealer]["dates"].append(r.date)

    result = []
    for dealer, data in summary.items():
        avg_rate = round(sum(data["avco_rate_list"]) / len(data["avco_rate_list"]), 2) if data["avco_rate_list"] else 0
        date_range = ""
        if data["dates"]:
            start = min(data["dates"])
            end = max(data["dates"])
            date_range = f"{frappe.utils.formatdate(start)} - {frappe.utils.formatdate(end)}"
        result.append({
            "dealer": dealer,
            "purities": ", ".join(sorted(data["purities"])),
            "total_weight": data["total_weight"],
            "avco_rate": avg_rate,
            "amount": data["amount"],
            "date_range": date_range
        })

    result.sort(key=lambda x: x["dealer"])
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

@frappe.whitelist()
def get_pending_pickup_overview(dealer=None):
    filters = {"is_pickup": 0, "docstatus": ["<", 2]}
    total_data = {}
    selected_data = {}

    items = frappe.get_all("Item Pickup", filters=filters, fields=["purity", "total_weight", "avco_rate", "amount", "dealer"])

    for i in items:
        # total overview
        total_data.setdefault(i.purity, {"weight":0, "avco":0, "amount":0})
        total_data[i.purity]["weight"] += i.total_weight or 0
        total_data[i.purity]["avco"] = i.avco_rate or 0
        total_data[i.purity]["amount"] += i.amount or 0

        # selected dealer overview
        if dealer and i.dealer == dealer:
            selected_data.setdefault(i.purity, {"weight":0, "avco":0, "amount":0})
            selected_data[i.purity]["weight"] += i.total_weight or 0
            selected_data[i.purity]["avco"] = i.avco_rate or 0
            selected_data[i.purity]["amount"] += i.amount or 0

    return {"total": total_data, "selected": selected_data}

#----------------------------------------------------************************------------------------------------------------------
# Pickup Item Staff Page
@frappe.whitelist()
def get_staff_pickup_items(dealer, is_pickup=0):
    """
    Fetch all non-pickup Item Pickup records for a given dealer.
    is_pickup defaults to 0 (non-picked items only)
    """
    user = frappe.session.user
    roles = frappe.get_roles(user)

    filters = {"dealer": dealer, "docstatus": ["<", 2]}
    
    # Apply non-pickup filter by default
    if is_pickup is not None and str(is_pickup) != "":
        filters["is_pickup"] = int(is_pickup)

    if "System Manager" not in roles and user != "Administrator":
        filters["assigned_to"] = user

    return frappe.get_all(
        "Item Pickup",
        fields=[
            "name",
            "date",
            "item_code",
            "purity",
            "total_weight",
            "avco_rate",
            "amount",
            "purchase_receipt",
            "assigned_to",
            "is_pickup",
            "dealer"
        ],
        filters=filters,
        order_by="date desc, name desc",
        ignore_permissions=False
    )
