import frappe

def execute(filters=None):
    filters = filters or {}

    dealer = filters.get("dealer")
    purity = filters.get("purity")

    conditions = []
    values = {}

    if dealer:
        conditions.append("dealer = %(dealer)s")
        values["dealer"] = dealer

    if purity:
        conditions.append("purity = %(purity)s")
        values["purity"] = purity

    where_clause = " AND ".join(conditions)
    if where_clause:
        where_clause = " AND " + where_clause

    # Fetch aggregated data split by is_pickup
    data = frappe.db.sql(f"""
        SELECT
            dealer,
            purity,
            is_pickup,
            SUM(total_weight) AS total_weight,
            ROUND(AVG(avco_rate), 2) AS avco_rate,
            SUM(amount) AS amount
        FROM
            `tabItem Pickup`
        WHERE
            docstatus < 2
            {where_clause}
        GROUP BY
            dealer, purity, is_pickup
        ORDER BY
            dealer, purity, is_pickup
    """, values, as_dict=True)

    # Add a readable type label
    for row in data:
        row["pickup_type"] = "Pickup" if row["is_pickup"] else "Non-Pickup"

    columns = [
        {"fieldname": "dealer", "label": "Dealer", "fieldtype": "Link", "options": "Supplier", "width": 150},
        {"fieldname": "purity", "label": "Purity", "fieldtype": "Link", "options": "Purity", "width": 150},
        {"fieldname": "pickup_type", "label": "Type", "fieldtype": "Data", "width": 120},
        {"fieldname": "total_weight", "label": "Total Weight (g)", "fieldtype": "Float", "width": 150},
        {"fieldname": "avco_rate", "label": "Avg AvCo (RM/g)", "fieldtype": "Currency", "width": 180},
        {"fieldname": "amount", "label": "Total Amount (MYR)", "fieldtype": "Currency", "width": 150},
    ]

    return columns, data
