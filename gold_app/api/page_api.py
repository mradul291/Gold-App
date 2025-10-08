import frappe
import json
from frappe import _
from frappe.utils import nowdate

#-------------------------------------------------------Pickup Items Page-----------------------------------------------------

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
        fields=["dealer", "dealer_name", "purity", "total_weight", "avco_rate", "amount", "date"],
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
                "dealer_name": r.dealer_name or "",
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
            "dealer_name": data["dealer_name"],
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
    """
    Returns total overview and selected dealer overview.
    dealer: string (comma-separated) or None
    """
    filters = {"is_pickup": 0, "docstatus": ["<", 2]}
    total_data = {}
    selected_data = {}

    items = frappe.get_all(
        "Item Pickup",
        filters=filters,
        fields=["purity", "total_weight", "avco_rate", "amount", "dealer"]
    )

    # Convert dealer param to a list
    selected_dealers = []
    if dealer:
        if isinstance(dealer, str):
            selected_dealers = [d.strip() for d in dealer.split(",") if d.strip()]
        elif isinstance(dealer, list):
            selected_dealers = dealer

    for i in items:
        # Total Overview
        total_data.setdefault(i.purity, {"weight": 0, "avco": 0, "amount": 0})
        total_data[i.purity]["weight"] += i.total_weight or 0
        total_data[i.purity]["avco"] = i.avco_rate or 0
        total_data[i.purity]["amount"] += i.amount or 0

        # Selected Dealer(s) Overview
        if selected_dealers and i.dealer in selected_dealers:
            selected_data.setdefault(i.purity, {"weight": 0, "avco": 0, "amount": 0})
            selected_data[i.purity]["weight"] += i.total_weight or 0
            selected_data[i.purity]["avco"] = i.avco_rate or 0
            selected_data[i.purity]["amount"] += i.amount or 0

    return {"total": total_data, "selected": selected_data}


#----------------------------------------------------Staff Pickup Items Page--------------------------------------------------
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
            "dealer",
            "dealer_name"
        ],
        filters=filters,
        order_by="date desc, name desc",
        ignore_permissions=False
    )

#-------------------------------------------------------Manager Pickup Page-----------------------------------------------------

# Pickup Item check by Manager
@frappe.whitelist()
def get_manager_pickup_items(dealer=None, is_pickup=None):
    """
    Fetch all pickup items for manager review with Tick All OK and Discrepancy fields.
    Dealer filter is optional so manager can view all dealers at once.
    """
    filters = {
                "docstatus": ["<", 2],
                "tick_all_ok": 0 
            }
    
    if dealer:
        filters["dealer"] = dealer
    if is_pickup is not None and str(is_pickup) != "":
        filters["is_pickup"] = 1 if str(is_pickup).lower() in ["1", "true", "yes"] else 0

    return frappe.get_all(
        "Item Pickup",
        fields=[
            "name",
            "date",
            "dealer",
            "dealer_name",
            "purity",
            "total_weight",
            "discrepancy_amount",
            "amount",
            "purchase_receipt",
            "tick_all_ok",      
            "discrepancy_action", 
        ],
        filters=filters,
        order_by="dealer asc, date desc"
    )

@frappe.whitelist()
def manager_bulk_update_pickup(doc_updates):
    """
    Bulk update Item Pickup documents from Manager Pickup page.
    doc_updates = JSON list of objects:
    [
        {"name": "IP-0001", "tick_all_ok": 1, "discrepancy_action": "Replace Item"},
        {"name": "IP-0002", "tick_all_ok": 0, "discrepancy_action": ""}
    ]
    """
    if isinstance(doc_updates, str):
        try:
            doc_updates = json.loads(doc_updates)
        except Exception:
            frappe.throw("Invalid doc_updates JSON")

    updated, skipped, errors = [], [], []

    for update in doc_updates:
        try:
            name = update.get("name")
            if not name:
                continue

            doc = frappe.get_doc("Item Pickup", name)
            if doc.docstatus != 0:
                skipped.append({"name": name, "reason": f"docstatus={doc.docstatus}"})
                continue
            if not doc.has_permission("write"):
                skipped.append({"name": name, "reason": "no write permission"})
                continue

            # Apply updates
            if "tick_all_ok" in update:
                doc.tick_all_ok = int(update["tick_all_ok"])
            if "discrepancy_action" in update:
                doc.discrepancy_action = update["discrepancy_action"]
            if "discrepancy_amount" in update:
                doc.discrepancy_amount = update["discrepancy_amount"]

            doc.save()
            updated.append(name)

        except Exception:
            errors.append({"name": update.get("name"), "trace": frappe.get_traceback()})

    frappe.db.commit()
    return {
        "updated": len(updated),
        "updated_list": updated,
        "skipped": skipped,
        "errors": errors
    }

# Create Dealer Pool Direct for Manager Veirifcation
@frappe.whitelist()
def create_manager_pool(pickup_names, pool_type="Dealer", notes=None):
    """
    Creates a Gold Pool directly from selected Manager Pickup items.
    This is similar to create_pool in pooling.py but kept separate
    for Manager Pickup UI workflow.
    """
    pickup_names = frappe.parse_json(pickup_names) if isinstance(pickup_names, str) else pickup_names
    if not pickup_names:
        frappe.throw("No pickups supplied for pool creation")

    # --- Step 1: Create new Gold Pool doc
    pool = frappe.new_doc("Gold Pool")
    pool.pool_type = pool_type
    pool.status = "Pending"
    pool.date_created = nowdate()
    pool.notes = notes or ""

    # --- Step 2: Aggregation containers
    totals_by_purity = {}
    cost_by_purity = {}
    total_weight = 0.0
    total_value = 0.0

    # --- Step 3: Loop through Item Pickups and aggregate
    for pickup_name in pickup_names:
        pu = frappe.get_doc("Item Pickup", pickup_name)

        pool.append("pool_items", {
            "item_pickup": pu.name,
            "dealer": pu.dealer,
            "date": pu.date,
            "purity": pu.purity,
            "total_weight": pu.total_weight or 0.0,
            "amount": pu.amount or 0.0,
            "avco_rate": pu.avco_rate or 0.0
        })

        weight = pu.total_weight or 0.0
        amount = pu.amount or 0.0

        totals_by_purity.setdefault(pu.purity, 0.0)
        totals_by_purity[pu.purity] += weight

        cost_by_purity.setdefault(pu.purity, 0.0)
        cost_by_purity[pu.purity] += amount

        total_weight += weight
        total_value += amount

    # --- Step 4: Populate Purity Breakdown
    for purity, weight in totals_by_purity.items():
        total_cost = cost_by_purity[purity]
        avco_rate = total_cost / weight if weight else 0.0
        pool.append("purity_breakdown", {
            "purity": purity,
            "total_weight": weight,
            "total_cost": total_cost,
            "avco_rate": avco_rate
        })

    # --- Step 5: Aggregate totals
    pool.total_weight = total_weight
    pool.total_value = total_value

    # --- Step 6: Insert pool doc
    pool.insert(ignore_permissions=True)
    
    for pickup_name in pickup_names:
        frappe.db.set_value("Item Pickup", pickup_name, {
            "pooled": 1,
            "pool_reference": pool.name
        })

    return {
        "pool_name": pool.name,
        "total_weight": total_weight,
        "total_value": total_value
    }
