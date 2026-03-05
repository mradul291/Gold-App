import frappe
from frappe.utils import flt, nowdate, date_diff

@frappe.whitelist()
def get_retail_inventory_overview():

    warehouse = "Retail - AGSB"

    rows = frappe.db.sql("""
        SELECT
            item.purity AS purity,
            COUNT(bin.item_code) AS no_items,
            SUM(bin.actual_qty) AS gross_weight,
            AVG(bin.valuation_rate) AS avg_rate,
            SUM(bin.actual_qty * bin.valuation_rate) AS total_cost
        FROM `tabBin` bin
        JOIN `tabItem` item ON item.name = bin.item_code
        WHERE bin.warehouse = %s
            AND bin.actual_qty > 0
        GROUP BY item.purity
        HAVING SUM(bin.actual_qty) > 0
        ORDER BY item.purity DESC
    """, (warehouse,), as_dict=True)

    purities = []
    total_weight = 0
    total_cost = 0
    total_xau = 0
    total_items = 0

    for r in rows:
        purity = flt(r.purity)
        weight = flt(r.gross_weight)
        cost = flt(r.total_cost)

        xau = weight * (purity / 1000)

        avco = cost / weight if weight else 0
        avco_xau = cost / xau if xau else 0

        purities.append({
            "purity": purity,
            "no_items": int(r.no_items),
            "gross_weight": round(weight, 2),
            "total_cost": round(cost, 2),
            "xau_g": round(xau, 3),
            "avco_rm_g": round(avco, 2),
            "avco_xau_rm_g": round(avco_xau, 2)
        })

        total_weight += weight
        total_cost += cost
        total_xau += xau

    # Total items (all statuses)
    total_items = frappe.db.sql("""
        SELECT COUNT(DISTINCT bin.item_code)
        FROM `tabBin` bin
        JOIN `tabItem` item ON item.name = bin.item_code
        WHERE bin.warehouse = %s
            AND bin.actual_qty > 0
            AND item.item_category = 'Retail'
    """, (warehouse,))[0][0] or 0


    # Available items only
    available_items = frappe.db.sql("""
        SELECT COUNT(DISTINCT bin.item_code)
        FROM `tabBin` bin
        JOIN `tabItem` item ON item.name = bin.item_code
        WHERE bin.warehouse = %s
            AND bin.actual_qty > 0
            AND item.item_category = 'Retail'
            AND item.retail_status = 'Available'
    """, (warehouse,))[0][0] or 0

    header = {
        "total_items": int(total_items),
        "available_items": int(available_items),
        "total_gross_weight": round(total_weight, 2),
        "total_xau": round(total_xau, 3),
        "total_value": round(total_cost, 2),
        "avco_xau_overall": round(total_cost / total_xau, 2) if total_xau else 0
    }

    return {
        "header": header,
        "purities": purities
    }

@frappe.whitelist()
def get_retail_inventory_items(page=1, page_size=8, filters=None):

    page = int(page)
    page_size = int(page_size)
    offset = (page - 1) * page_size
    warehouse = "Retail - AGSB"

    if isinstance(filters, str):
        filters = frappe.parse_json(filters)

    filters = filters or {}

    conditions = [
        "bin.warehouse = %(warehouse)s",
        "bin.actual_qty > 0",
        "item.item_category = 'Retail'"
    ]

    values = {
        "warehouse": warehouse
    }

    # -----------------------
    # SEARCH FILTER
    # -----------------------
    if filters.get("search"):
        conditions.append("""
            (
                item.name LIKE %(search)s OR
                item.rfid_tag LIKE %(search)s OR
                item.description LIKE %(search)s
            )
        """)
        values["search"] = f"%{filters.get('search')}%"

    # -----------------------
    # ITEM TYPE
    # -----------------------
    if filters.get("item_type"):
        conditions.append("item.item_group = %(item_type)s")
        values["item_type"] = filters.get("item_type")

    # -----------------------
    # PURITY
    # -----------------------
    if filters.get("purity"):
        conditions.append("item.purity = %(purity)s")
        values["purity"] = filters.get("purity")

    # -----------------------
    # STATUS
    # -----------------------
    if filters.get("status"):
        conditions.append("item.retail_status = %(status)s")
        values["status"] = filters.get("status")

    # -----------------------
    # AGING FILTER
    # -----------------------
    if filters.get("aging"):
        aging = filters.get("aging")

        if aging == "0-30":
            conditions.append("DATEDIFF(CURDATE(), item.purchase_date) BETWEEN 0 AND 30")
        elif aging == "31-60":
            conditions.append("DATEDIFF(CURDATE(), item.purchase_date) BETWEEN 31 AND 60")
        elif aging == "61-90":
            conditions.append("DATEDIFF(CURDATE(), item.purchase_date) BETWEEN 61 AND 90")
        elif aging == "90+":
            conditions.append("DATEDIFF(CURDATE(), item.purchase_date) > 90")

    where_clause = " AND ".join(conditions)

    # -----------------------
    # TOTAL COUNT
    # -----------------------
    total_count = frappe.db.sql(f"""
        SELECT COUNT(*)
        FROM `tabBin` bin
        JOIN `tabItem` item ON item.name = bin.item_code
        WHERE {where_clause}
    """, values)[0][0] or 0

    # -----------------------
    # FETCH DATA
    # -----------------------
    rows = frappe.db.sql(f"""
        SELECT
            item.name AS item_code,
            item.image,
            item.item_group,
            ig.image AS item_group_image,
            item.purity,
            item.gross_weight_g,
            item.length_size,
            item.valuation_rate,
            item.rfid_tag,
            item.purchase_date,
            item.retail_status
        FROM `tabBin` bin
        JOIN `tabItem` item ON item.name = bin.item_code
        LEFT JOIN `tabItem Group` ig ON ig.name = item.item_group
        WHERE {where_clause}
        ORDER BY item.creation DESC
        LIMIT %(limit)s OFFSET %(offset)s
    """, {**values, "limit": page_size, "offset": offset}, as_dict=True)

    items = []

    for r in rows:
        days = date_diff(nowdate(), r.purchase_date) if r.purchase_date else 0

        items.append({
            "item_code": r.item_code,
            "image": r.image,
            "item_type": r.item_group,
            "item_group_image": r.item_group_image,
            "purity": r.purity,
            "weight": r.gross_weight_g,
            "length_size": r.length_size,
            "cost_price": r.valuation_rate,
            "rfid_tag": r.rfid_tag,
            "days": days,
            "status": r.retail_status
        })

    return {
        "items": items,
        "total_count": total_count,
        "page": page,
        "page_size": page_size
    }
    
@frappe.whitelist()
def get_retail_filter_data():

    # Item Groups under Retail
    item_groups = frappe.get_all(
        "Item Group",
        filters={"parent_item_group": "Retail"},
        fields=["name"],
        order_by="name asc"
    )

    # Purity Doctype
    purities = frappe.get_all(
        "Purity",
        fields=["name", "purity_name"],
        order_by="purity_name desc"
    )

    return {
        "item_groups": item_groups,
        "purities": purities
    }