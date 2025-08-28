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

    data = frappe.db.sql(f"""
        SELECT
            dealer,
            purity,
            SUM(total_weight) AS total_weight,
            ROUND(AVG(avco_rate), 2) AS avco_rate,
            SUM(amount) AS amount
        FROM
            `tabItem Pickup`
        WHERE
            docstatus < 2
            {where_clause}
        GROUP BY
            dealer, purity
        ORDER BY
            dealer, purity
    """, values, as_dict=True)

    columns = [
        {"fieldname": "dealer", "label": "Dealer", "fieldtype": "Link", "options": "Supplier", "width": 150},
        {"fieldname": "purity", "label": "Purity", "fieldtype": "Link", "options": "Purity", "width": 150},
        {"fieldname": "total_weight", "label": "Total Weight (g)", "fieldtype": "Float", "width": 150},
        {"fieldname": "avco_rate", "label": "Avg AvCo (RM/g)", "fieldtype": "Currency", "width": 150},
        {"fieldname": "amount", "label": "Total Amount (MYR)", "fieldtype": "Currency", "width": 150},
    ]

    return columns, data
