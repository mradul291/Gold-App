import frappe
from frappe import _

@frappe.whitelist()
def get_all_bag_overview():

    bag_rows = frappe.db.sql("""
        SELECT
            bin.warehouse AS bag_id,
            item.purity AS purity,
            SUM(bin.actual_qty) AS weight,
            AVG(bin.valuation_rate) AS rate,
            SUM(bin.actual_qty * bin.valuation_rate) AS amount
        FROM
            `tabBin` AS bin
        JOIN `tabItem` AS item 
            ON bin.item_code = item.name
        JOIN `tabWarehouse` AS wh
            ON wh.name = bin.warehouse
        WHERE
            wh.parent_warehouse = 'Wholesale - AGSB'
        GROUP BY 
            bin.warehouse, item.purity
        HAVING 
            SUM(bin.actual_qty) > 0
    """, as_dict=True)

    # Organize per bag
    bags = {}
    for row in bag_rows:
        bag = bags.setdefault(row["bag_id"], {
            "bag_id": row["bag_id"],
            "bag_total": 0,
            "purities": []
        })
        bag["purities"].append({
            "purity": row["purity"],
            "weight": round(row["weight"], 2),
            "rate": round(row["rate"], 2)
        })
        bag["bag_total"] += float(row["amount"])

    bag_list = []
    for bag in bags.values():
        bag["bag_total"] = round(bag["bag_total"], 2)
        bag_list.append(bag)

    return bag_list
