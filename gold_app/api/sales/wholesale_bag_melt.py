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
